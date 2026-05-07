import { anthropic, ANTHROPIC_MODEL, PROMPT_CACHE_ENABLED } from './client';
import { labelExtractionSchema, type LabelExtraction } from './schemas/label-extraction';
import { LABEL_EXTRACTION_SYSTEM_PROMPT } from './prompts/label-extraction';

/**
 * Extrai dados estruturados de etiqueta de pacote via Claude Haiku 4.5 vision.
 *
 * Story 3.5. Cobre:
 *   - Vision com base64 (não URL pública — segurança)
 *   - Prompt caching ephemeral (sugestão @po implementada)
 *   - temperature: 0 (determinístico)
 *   - Strip de markdown se IA encerrar JSON em ```json
 *   - Fallback graceful: confianca=0 + raw error se schema falhar
 *   - Telemetria de tokens (cache create/read/input/output) — sugestão @po
 */

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png']);

export interface ExtractLabelInput {
  buffer: Buffer;
  mimeType: string;
}

export interface ExtractLabelResult {
  /** JSON validado pelo Zod (ou raw error). */
  json: LabelExtraction | { error: string; raw_text?: string };
  /** Confiança final (0 se erro). */
  confianca: number;
  /** Métricas de uso para telemetria de custo (NFR-041). */
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  /** Modelo usado (audit). */
  model: string;
  /** Duração em ms. */
  durationMs: number;
}

/** Strip de markdown json se IA envolver a resposta. */
function stripMarkdownJson(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

export async function extractLabelFromImage(
  input: ExtractLabelInput,
): Promise<ExtractLabelResult> {
  if (!ALLOWED_MIMES.has(input.mimeType)) {
    throw new Error(
      `Mime type não suportado para extração: ${input.mimeType}. Use image/jpeg ou image/png.`,
    );
  }
  if (input.buffer.length === 0) {
    throw new Error('Buffer da imagem está vazio');
  }

  const startedAt = Date.now();
  const base64 = input.buffer.toString('base64');

  const systemBlock = PROMPT_CACHE_ENABLED
    ? [
        {
          type: 'text' as const,
          text: LABEL_EXTRACTION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        },
      ]
    : LABEL_EXTRACTION_SYSTEM_PROMPT;

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 500,
    temperature: 0,
    system: systemBlock,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: input.mimeType as 'image/jpeg' | 'image/png',
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Extraia os dados desta etiqueta seguindo o schema. Retorne APENAS o JSON.',
          },
        ],
      },
    ],
  });

  const durationMs = Date.now() - startedAt;

  const firstText = response.content.find((b) => b.type === 'text');
  if (!firstText || firstText.type !== 'text') {
    throw new Error('Resposta da IA não contém bloco de texto');
  }

  const cleanedText = stripMarkdownJson(firstText.text);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleanedText);
  } catch {
    return {
      json: { error: 'invalid_json_from_ia', raw_text: cleanedText.slice(0, 500) },
      confianca: 0,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? undefined,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? undefined,
      },
      model: response.model,
      durationMs,
    };
  }

  const validated = labelExtractionSchema.safeParse(parsedJson);
  if (!validated.success) {
    return {
      json: {
        error: 'schema_validation_failed',
        raw_text: JSON.stringify(parsedJson).slice(0, 500),
      },
      confianca: 0,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? undefined,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? undefined,
      },
      model: response.model,
      durationMs,
    };
  }

  return {
    json: validated.data,
    confianca: validated.data.confianca,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? undefined,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? undefined,
    },
    model: response.model,
    durationMs,
  };
}
