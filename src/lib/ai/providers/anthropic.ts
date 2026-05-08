import Anthropic from '@anthropic-ai/sdk';
import { LABEL_EXTRACTION_SYSTEM_PROMPT } from '../prompts/label-extraction';
import { labelExtractionSchema } from '../schemas/label-extraction';
import type { ExtractInput, ExtractResult, LabelExtractor } from './types';
import { ALLOWED_MIMES } from './types';

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };

function buildClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === '' || apiKey === 'sk-ant-') {
    // Build-time fallback: Next.js 15 page data collection instancia clients
    // mesmo de routes dynamic. Erro real só aparece em runtime quando rota
    // tenta usar o client — SDK valida na call.
    return new Anthropic({ apiKey: 'sk-ant-buildtime-placeholder' });
  }
  return new Anthropic({ apiKey });
}

const anthropic: Anthropic = globalForAnthropic.anthropic ?? buildClient();
if (process.env.NODE_ENV !== 'production') globalForAnthropic.anthropic = anthropic;

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
const PROMPT_CACHE_ENABLED =
  (process.env.ANTHROPIC_PROMPT_CACHE_ENABLED ?? 'true').toLowerCase() === 'true';

function stripMarkdownJson(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

export class AnthropicLabelExtractor implements LabelExtractor {
  readonly provider = 'anthropic' as const;
  readonly defaultModel = ANTHROPIC_MODEL;

  async extract(input: ExtractInput): Promise<ExtractResult> {
    if (!ALLOWED_MIMES.has(input.mimeType)) {
      throw new Error(`Mime não suportado para extração: ${input.mimeType}`);
    }
    if (input.buffer.length === 0) throw new Error('Buffer da imagem está vazio');

    const startedAt = Date.now();

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
                data: input.buffer.toString('base64'),
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
      throw new Error('Resposta Anthropic sem bloco de texto');
    }

    const cleaned = stripMarkdownJson(firstText.text);
    const usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? undefined,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? undefined,
    };

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        json: { error: 'invalid_json_from_ia', raw_text: cleaned.slice(0, 500) },
        confianca: 0,
        usage,
        model: response.model,
        provider: 'anthropic',
        durationMs,
      };
    }

    const validated = labelExtractionSchema.safeParse(parsed);
    if (!validated.success) {
      return {
        json: { error: 'schema_validation_failed', raw_text: JSON.stringify(parsed).slice(0, 500) },
        confianca: 0,
        usage,
        model: response.model,
        provider: 'anthropic',
        durationMs,
      };
    }

    return {
      json: validated.data,
      confianca: validated.data.confianca,
      usage,
      model: response.model,
      provider: 'anthropic',
      durationMs,
    };
  }
}
