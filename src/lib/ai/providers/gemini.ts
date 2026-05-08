import { GoogleGenerativeAI } from '@google/generative-ai';
import { LABEL_EXTRACTION_SYSTEM_PROMPT } from '../prompts/label-extraction';
import { labelExtractionSchema } from '../schemas/label-extraction';
import type { ExtractInput, ExtractResult, LabelExtractor } from './types';
import { ALLOWED_MIMES } from './types';

const globalForGemini = globalThis as unknown as {
  geminiClient?: GoogleGenerativeAI;
};

function buildClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('GOOGLE_API_KEY ausente em produção');
    }
    return new GoogleGenerativeAI('placeholder-buildtime');
  }
  return new GoogleGenerativeAI(apiKey);
}

const client = globalForGemini.geminiClient ?? buildClient();
if (process.env.NODE_ENV !== 'production') globalForGemini.geminiClient = client;

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';

function stripMarkdownJson(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

export class GeminiLabelExtractor implements LabelExtractor {
  readonly provider = 'gemini' as const;
  readonly defaultModel = GEMINI_MODEL;

  async extract(input: ExtractInput): Promise<ExtractResult> {
    if (!ALLOWED_MIMES.has(input.mimeType)) {
      throw new Error(`Mime não suportado para extração: ${input.mimeType}`);
    }
    if (input.buffer.length === 0) throw new Error('Buffer da imagem está vazio');

    const startedAt = Date.now();
    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: LABEL_EXTRACTION_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
      },
    });

    const response = await model.generateContent([
      {
        inlineData: {
          mimeType: input.mimeType,
          data: input.buffer.toString('base64'),
        },
      },
      {
        text: 'Extraia os dados desta etiqueta seguindo o schema. Retorne APENAS o JSON.',
      },
    ]);

    const durationMs = Date.now() - startedAt;
    const text = response.response.text();
    const cleaned = stripMarkdownJson(text);
    const usage = {
      input_tokens: response.response.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: response.response.usageMetadata?.candidatesTokenCount ?? 0,
    };

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        json: { error: 'invalid_json_from_ia', raw_text: cleaned.slice(0, 500) },
        confianca: 0,
        usage,
        model: GEMINI_MODEL,
        provider: 'gemini',
        durationMs,
      };
    }

    const validated = labelExtractionSchema.safeParse(parsed);
    if (!validated.success) {
      return {
        json: { error: 'schema_validation_failed', raw_text: JSON.stringify(parsed).slice(0, 500) },
        confianca: 0,
        usage,
        model: GEMINI_MODEL,
        provider: 'gemini',
        durationMs,
      };
    }

    return {
      json: validated.data,
      confianca: validated.data.confianca,
      usage,
      model: GEMINI_MODEL,
      provider: 'gemini',
      durationMs,
    };
  }
}
