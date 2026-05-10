/**
 * Script de smoke test da extração de etiqueta.
 * Permite testar Haiku 4.5 vs Sonnet 4.6 com o mesmo prompt.
 *
 * Uso:
 *   npx tsx scripts/test-extract-labels.ts                 # haiku
 *   ANTHROPIC_MODEL=claude-sonnet-4-6 npx tsx scripts/test-extract-labels.ts
 *   COMPARE=1 npx tsx scripts/test-extract-labels.ts       # roda os 2 modelos
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { labelExtractionSchema } from '../src/lib/ai/schemas/label-extraction';
import { LABEL_EXTRACTION_SYSTEM_PROMPT } from '../src/lib/ai/prompts/label-extraction';

const ROOT = path.resolve(__dirname, '..');

const SAMPLES: Array<{ file: string; label: string }> = [
  { file: 'scripts/dev/fixtures/etiquetas/magalu.jpeg', label: 'Magalu' },
  { file: 'scripts/dev/fixtures/etiquetas/melhorEnvio1.jpeg', label: 'Melhor Envio 1 (SEDEX)' },
  { file: 'scripts/dev/fixtures/etiquetas/melhorEnvio2.jpeg', label: 'Melhor Envio 2 (PAC)' },
  { file: 'scripts/dev/fixtures/etiquetas/superFrete.jpeg', label: 'SuperFrete (Loggi)' },
  { file: 'scripts/dev/fixtures/etiquetas/pacote_teste.jpeg', label: 'Pacote real (Mercado Livre Flex)' },
];

// Pricing (USD por 1M tokens) — abr/2026
// Haiku 4.5:  input $1.00 / output $5.00
// Sonnet 4.6: input $3.00 / output $15.00
// Opus 4.7:   input $15.00 / output $75.00
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-6-20250709': { input: 3.0, output: 15.0 },
  'claude-opus-4-7': { input: 15.0, output: 75.0 },
};

function calcCostUsd(model: string, inTokens: number, outTokens: number): number {
  const p = PRICES[model] ?? { input: 0, output: 0 };
  return (inTokens * p.input + outTokens * p.output) / 1_000_000;
}

function stripMarkdown(t: string): string {
  return t
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

async function runOne(model: string, buffer: Buffer) {
  const client = new Anthropic();
  const startedAt = Date.now();
  // Opus 4.7+ não aceita temperature
  const supportsTemp = !model.startsWith('claude-opus-4-7');
  const res = await client.messages.create({
    model,
    max_tokens: 500,
    ...(supportsTemp ? { temperature: 0 } : {}),
    system: LABEL_EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: buffer.toString('base64') },
          },
          {
            type: 'text',
            text: 'Extraia os dados desta etiqueta seguindo o schema. Retorne APENAS o JSON.',
          },
        ],
      },
    ],
  });
  const durMs = Date.now() - startedAt;
  const txt = res.content.find((b) => b.type === 'text');
  if (!txt || txt.type !== 'text') throw new Error('sem texto');
  const cleaned = stripMarkdown(txt.text);
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    json = { error: 'invalid_json', raw: cleaned.slice(0, 200) };
  }
  const validated = labelExtractionSchema.safeParse(json);
  return {
    model: res.model,
    durMs,
    inTokens: res.usage.input_tokens,
    outTokens: res.usage.output_tokens,
    json: validated.success ? validated.data : json,
    valid: validated.success,
  };
}

async function main() {
  const compare = process.env.COMPARE === '1';
  const modelEnv = process.env.ANTHROPIC_MODEL;
  const models = compare
    ? ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6']
    : [modelEnv ?? 'claude-haiku-4-5-20251001'];

  const totals: Record<string, { reqs: number; in: number; out: number; cost: number; ms: number }> = {};

  for (const m of models) {
    totals[m] = { reqs: 0, in: 0, out: 0, cost: 0, ms: 0 };
  }

  for (const s of SAMPLES) {
    const filePath = path.join(ROOT, s.file);
    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch {
      console.log(`\n=== ${s.label} === SKIP (arquivo não encontrado)`);
      continue;
    }
    console.log(`\n=== ${s.label} (${(buffer.length / 1024).toFixed(0)} KB) ===`);

    for (const m of models) {
      try {
        const r = await runOne(m, buffer);
        const cost = calcCostUsd(r.model, r.inTokens, r.outTokens);
        const acc = totals[m]!;
        acc.reqs++;
        acc.in += r.inTokens;
        acc.out += r.outTokens;
        acc.cost += cost;
        acc.ms += r.durMs;
        console.log(
          `[${r.model}] ${r.durMs}ms | in=${r.inTokens} out=${r.outTokens} | $${cost.toFixed(5)} | ${r.valid ? 'valid' : 'INVALID'}`,
        );
        console.log(JSON.stringify(r.json, null, 2));
      } catch (e) {
        console.log(`[${m}] ERRO: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  console.log('\n=== TOTAIS ===');
  for (const m of models) {
    const t = totals[m];
    if (!t || t.reqs === 0) continue;
    const avgCost = t.cost / t.reqs;
    const avgMs = t.ms / t.reqs;
    console.log(
      `${m}: ${t.reqs} req | avg ${avgMs.toFixed(0)}ms | total $${t.cost.toFixed(4)} | avg $${avgCost.toFixed(5)}/foto | × 1000 fotos = $${(avgCost * 1000).toFixed(2)}`,
    );
  }
}

main().catch((e) => {
  console.error('Falha:', e);
  process.exit(1);
});
