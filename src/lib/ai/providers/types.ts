import type { LabelExtraction } from '../schemas/label-extraction';

export const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png']);

export interface ExtractInput {
  buffer: Buffer;
  mimeType: string;
}

export interface ExtractUsage {
  input_tokens: number;
  output_tokens: number;
  /** Anthropic-specific. Omitido para Gemini. */
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ExtractResult {
  /** JSON validado pelo schema, ou objeto de erro. */
  json: LabelExtraction | { error: string; raw_text?: string };
  /** 0..1. 0 = falhou. */
  confianca: number;
  /** Telemetria de custo (NFR-041). */
  usage: ExtractUsage;
  /** Identificador do modelo (ex: "claude-haiku-4-5", "gemini-2.5-flash-lite"). */
  model: string;
  /** Provider que respondeu (informativo + telemetria). */
  provider: 'anthropic' | 'gemini';
  /** Duração ms da chamada upstream. */
  durationMs: number;
}

/**
 * Contrato do extrator de etiqueta. Cada provider implementa essa interface.
 *
 * Princípios:
 *   - Idempotente em entrada vazia/inválida (lança Error legível, sem leak)
 *   - Não faz retry — quem chama é responsável (centralizado em extract-label.ts)
 *   - Não loga — quem chama instrumenta com pino (job logger)
 */
export interface LabelExtractor {
  readonly provider: 'anthropic' | 'gemini';
  readonly defaultModel: string;
  extract(input: ExtractInput): Promise<ExtractResult>;
}
