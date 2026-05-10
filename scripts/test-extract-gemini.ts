/**
 * Smoke test de extração de etiqueta com Gemini Flash-Lite.
 *
 * Reusa o MESMO prompt do software (LABEL_EXTRACTION_SYSTEM_PROMPT) e o
 * MESMO schema Zod, só troca o provider.
 *
 * Uso:
 *   GOOGLE_API_KEY=... node --env-file=.env --import tsx scripts/test-extract-gemini.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { labelExtractionSchema } from '../src/lib/ai/schemas/label-extraction';
import { LABEL_EXTRACTION_SYSTEM_PROMPT } from '../src/lib/ai/prompts/label-extraction';

const ROOT = path.resolve(__dirname, '..');

const SAMPLES: Array<{ file: string; label: string }> = [
  { file: 'scripts/dev/fixtures/etiquetas/magalu.jpeg', label: 'Magalu' },
  { file: 'scripts/dev/fixtures/etiquetas/melhorEnvio1.jpeg', label: 'Melhor Envio 1 (SEDEX)' },
  { file: 'scripts/dev/fixtures/etiquetas/melhorEnvio2.jpeg', label: 'Melhor Envio 2 (PAC)' },
  { file: 'scripts/dev/fixtures/etiquetas/superFrete.jpeg', label: 'SuperFrete (Loggi)' },
  { file: 'scripts/dev/fixtures/etiquetas/pacote_teste.jpeg', label: 'Pacote real (ML Flex)' },
];

// Pricing (USD por 1M tokens)
// Gemini 2.5 Flash-Lite: input $0.10 / output $0.40
// Gemini 2.5 Flash:      input $0.30 / output $2.50
const PRICES: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.0-flash-exp': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash': { input: 0.075, output: 0.3 },
};

function calcCostUsd(model: string, inT: number, outT: number): number {
  const p = PRICES[model] ?? { input: 0, output: 0 };
  return (inT * p.input + outT * p.output) / 1_000_000;
}

function stripMarkdown(t: string): string {
  return t
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

async function runOne(modelName: string, buffer: Buffer) {
  const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY não configurada');
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: LABEL_EXTRACTION_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 500,
      responseMimeType: 'application/json',
    },
  });

  const startedAt = Date.now();
  const res = await model.generateContent([
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: buffer.toString('base64'),
      },
    },
    {
      text: 'Extraia os dados desta etiqueta seguindo o schema. Retorne APENAS o JSON.',
    },
  ]);
  const durMs = Date.now() - startedAt;

  const text = res.response.text();
  const cleaned = stripMarkdown(text);
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    json = { error: 'invalid_json', raw: cleaned.slice(0, 200) };
  }
  const validated = labelExtractionSchema.safeParse(json);

  const usage = res.response.usageMetadata;
  return {
    model: modelName,
    durMs,
    inTokens: usage?.promptTokenCount ?? 0,
    outTokens: usage?.candidatesTokenCount ?? 0,
    json: validated.success ? validated.data : json,
    valid: validated.success,
  };
}

async function main() {
  const models = (process.env.GEMINI_MODELS ?? 'gemini-2.5-flash-lite,gemini-2.5-flash')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const totals: Record<string, { reqs: number; in: number; out: number; cost: number; ms: number }> = {};
  for (const m of models) totals[m] = { reqs: 0, in: 0, out: 0, cost: 0, ms: 0 };

  for (const s of SAMPLES) {
    const filePath = path.join(ROOT, s.file);
    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch {
      console.log(`\n=== ${s.label} === SKIP`);
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
