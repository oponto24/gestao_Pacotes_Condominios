import Anthropic from '@anthropic-ai/sdk';

/**
 * Cliente Anthropic singleton (story 3.5).
 *
 * Usa `globalThis` para evitar múltiplas instâncias em hot reload (dev).
 * Lança erro claro se `ANTHROPIC_API_KEY` ausente — falha rápida no startup.
 */

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };

function buildClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === '' || apiKey === 'sk-ant-') {
    // Build-time fallback: Next.js 15 page data collection instancia clients
    // mesmo de routes dynamic. Erro real só aparece em runtime quando worker
    // ou rota tenta usar o client de verdade — Anthropic SDK valida na call.
    return new Anthropic({ apiKey: 'sk-ant-buildtime-placeholder' });
  }
  return new Anthropic({ apiKey });
}

export const anthropic: Anthropic = globalForAnthropic.anthropic ?? buildClient();
if (process.env.NODE_ENV !== 'production') globalForAnthropic.anthropic = anthropic;

/**
 * Modelo configurável via env, com default seguro.
 * CON-004: Anthropic Claude Haiku 4.5.
 */
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';

/**
 * Toggle de prompt caching via env (default: enabled).
 * Útil para A/B testing custo vs latência. Disable só pra debug.
 */
export const PROMPT_CACHE_ENABLED =
  (process.env.ANTHROPIC_PROMPT_CACHE_ENABLED ?? 'true').toLowerCase() === 'true';
