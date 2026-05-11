/**
 * Cálculo de custo IA a partir de tokens consumidos.
 *
 * `extract-label.ts` salva tokens em `PacoteEvento.metadata` (tipo=ia_processou):
 *   { provider, model, input_tokens, output_tokens,
 *     cache_creation_input_tokens?, cache_read_input_tokens? }
 *
 * Este helper agrega + multiplica pelo preço por modelo. Preços atualizados
 * em 2026-05-11 — confira tabelas oficiais e atualize aqui quando mudar:
 *   Anthropic: https://www.anthropic.com/pricing
 *   Google:    https://ai.google.dev/pricing
 */

import { withSuperAdmin } from '@/lib/db-super-admin';

/** USD/1M tokens. Tem que ser atualizado quando o provider mudar pricing. */
interface ModelPricing {
  input: number;
  output: number;
  cacheCreate?: number;
  cacheRead?: number;
}

const PRICING_USD_PER_MTOK: Record<string, ModelPricing> = {
  // Anthropic
  'claude-haiku-4-5': {
    input: 1.0,
    output: 5.0,
    cacheCreate: 1.25,
    cacheRead: 0.1,
  },
  'claude-haiku-4-5-20251001': {
    input: 1.0,
    output: 5.0,
    cacheCreate: 1.25,
    cacheRead: 0.1,
  },
  'claude-sonnet-4-5': {
    input: 3.0,
    output: 15.0,
    cacheCreate: 3.75,
    cacheRead: 0.3,
  },
  'claude-sonnet-4-6': {
    input: 3.0,
    output: 15.0,
    cacheCreate: 3.75,
    cacheRead: 0.3,
  },
  'claude-opus-4-7': {
    input: 15.0,
    output: 75.0,
    cacheCreate: 18.75,
    cacheRead: 1.5,
  },
  // Google Gemini Flash-Lite (default atual — ~15x mais barato que Haiku)
  'gemini-2.5-flash-lite': {
    input: 0.1,
    output: 0.4,
  },
  'gemini-2.0-flash-lite': {
    input: 0.075,
    output: 0.3,
  },
};

/** Cotação USD→BRL aproximada (atualizar manualmente). */
const USD_TO_BRL = 5.5;

export interface IaUsageRow {
  provider: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  costBrl: number;
}

export interface IaUsageSummary {
  rows: IaUsageRow[];
  totalCostUsd: number;
  totalCostBrl: number;
  totalCalls: number;
  unpricedModels: string[]; // modelos sem entrada na tabela (custo subestimado)
}

/**
 * Computa custo per-modelo agregado a partir do PacoteEvento.
 * Bypassa RLS via super-admin context (uso global pra super-admin).
 */
export async function getIaUsageSummary(): Promise<IaUsageSummary> {
  const eventos = await withSuperAdmin(async (tx) => {
    return tx.pacoteEvento.findMany({
      where: { tipo: 'ia_processou' },
      select: { metadata: true },
    });
  });

  const acc = new Map<string, IaUsageRow>();
  const unpriced = new Set<string>();

  for (const evt of eventos) {
    if (!evt.metadata || typeof evt.metadata !== 'object') continue;
    const meta = evt.metadata as Record<string, unknown>;
    const provider = typeof meta.provider === 'string' ? meta.provider : 'unknown';
    const model = typeof meta.model === 'string' ? meta.model : 'unknown';
    const inputTokens = typeof meta.input_tokens === 'number' ? meta.input_tokens : 0;
    const outputTokens = typeof meta.output_tokens === 'number' ? meta.output_tokens : 0;
    const cacheCreate =
      typeof meta.cache_creation_input_tokens === 'number'
        ? meta.cache_creation_input_tokens
        : 0;
    const cacheRead =
      typeof meta.cache_read_input_tokens === 'number'
        ? meta.cache_read_input_tokens
        : 0;

    const key = `${provider}:${model}`;
    const pricing = PRICING_USD_PER_MTOK[model];
    if (!pricing) unpriced.add(model);

    const costUsd = pricing
      ? (inputTokens * pricing.input +
          outputTokens * pricing.output +
          cacheCreate * (pricing.cacheCreate ?? pricing.input) +
          cacheRead * (pricing.cacheRead ?? pricing.input)) /
        1_000_000
      : 0;

    const cur = acc.get(key);
    if (cur) {
      cur.calls += 1;
      cur.inputTokens += inputTokens;
      cur.outputTokens += outputTokens;
      cur.cacheCreateTokens += cacheCreate;
      cur.cacheReadTokens += cacheRead;
      cur.costUsd += costUsd;
      cur.costBrl += costUsd * USD_TO_BRL;
    } else {
      acc.set(key, {
        provider,
        model,
        calls: 1,
        inputTokens,
        outputTokens,
        cacheCreateTokens: cacheCreate,
        cacheReadTokens: cacheRead,
        costUsd,
        costBrl: costUsd * USD_TO_BRL,
      });
    }
  }

  const rows = [...acc.values()].sort((a, b) => b.costUsd - a.costUsd);
  const totalCostUsd = rows.reduce((s, r) => s + r.costUsd, 0);

  return {
    rows,
    totalCostUsd,
    totalCostBrl: totalCostUsd * USD_TO_BRL,
    totalCalls: rows.reduce((s, r) => s + r.calls, 0),
    unpricedModels: [...unpriced],
  };
}

export { USD_TO_BRL };
