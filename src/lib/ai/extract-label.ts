/**
 * Entry point provider-agnóstico para extração de etiqueta.
 *
 * Decisão arquitetural (2026-05-08): Gemini Flash-Lite é default novo —
 * 15x mais barato que Anthropic Haiku 4.5 com acurácia equivalente
 * (smoke test em 5 etiquetas reais — ver `docs/decisions/ai-model-comparison.md`).
 *
 * Provider e fallback configuráveis por env:
 *   - EXTRACT_LABEL_PROVIDER=gemini|anthropic   (default: gemini)
 *   - EXTRACT_LABEL_FALLBACK=anthropic|none     (default: anthropic)
 *   - EXTRACT_LABEL_MAX_RETRIES=3               (default: 3)
 *
 * Backwards-compat: rotas/jobs antigos importavam de `lib/anthropic/extract-label`.
 * Esse arquivo segue exportando o mesmo nome `extractLabelFromImage` com a
 * mesma assinatura.
 */
import { AnthropicLabelExtractor } from './providers/anthropic';
import { GeminiLabelExtractor } from './providers/gemini';
import type {
  ExtractInput,
  ExtractResult,
  LabelExtractor,
} from './providers/types';

export type { ExtractInput, ExtractResult } from './providers/types';
export type { LabelExtraction } from './schemas/label-extraction';

type ProviderName = 'gemini' | 'anthropic';

function getProvider(name: ProviderName): LabelExtractor {
  switch (name) {
    case 'anthropic':
      return new AnthropicLabelExtractor();
    case 'gemini':
      return new GeminiLabelExtractor();
  }
}

const PRIMARY: ProviderName = (process.env.EXTRACT_LABEL_PROVIDER as ProviderName) ?? 'gemini';
const FALLBACK_ENV = (process.env.EXTRACT_LABEL_FALLBACK ?? 'anthropic').toLowerCase();
const FALLBACK: ProviderName | null =
  FALLBACK_ENV === 'none' || FALLBACK_ENV === '' ? null : (FALLBACK_ENV as ProviderName);

const MAX_RETRIES = Number.parseInt(process.env.EXTRACT_LABEL_MAX_RETRIES ?? '3', 10);

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // 503 Service Unavailable, 429 Too Many Requests, 500/502/504 transitórios
  return /\b(429|500|502|503|504)\b/.test(msg) || /timeout|ECONN|EAI_AGAIN/i.test(msg);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function extractWithRetry(
  extractor: LabelExtractor,
  input: ExtractInput,
): Promise<ExtractResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await extractor.extract(input);
    } catch (e) {
      lastErr = e;
      if (attempt === MAX_RETRIES || !isRetryable(e)) break;
      // Backoff exponencial: 500ms, 1s, 2s, 4s...
      const delayMs = 500 * Math.pow(2, attempt);
      await sleep(delayMs);
    }
  }
  throw lastErr ?? new Error('extractWithRetry: erro desconhecido');
}

/**
 * Extrai dados de etiqueta com provider primário + retry + fallback.
 */
export async function extractLabelFromImage(
  input: ExtractInput,
): Promise<ExtractResult> {
  const primary = getProvider(PRIMARY);
  try {
    return await extractWithRetry(primary, input);
  } catch (primaryErr) {
    if (!FALLBACK || FALLBACK === PRIMARY) throw primaryErr;
    // Falhou após retries — tenta fallback (1 attempt, sem retry).
    const fallback = getProvider(FALLBACK);
    try {
      const result = await fallback.extract(input);
      return result;
    } catch {
      // Se o fallback também falhar, re-lança erro original (mais informativo)
      throw primaryErr;
    }
  }
}
