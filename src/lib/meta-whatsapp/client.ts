import { MetaApiError } from './errors';
import type {
  MetaApiErrorResponse,
  MetaSendMessageRequest,
  MetaSendMessageResponse,
  SendTemplateInput,
  SendTemplateResult,
} from './types';

const DEFAULT_API_VERSION = 'v25.0';
const REQUEST_TIMEOUT_MS = 15_000;

interface MetaClientConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  disabled: boolean;
}

function loadConfig(): MetaClientConfig {
  const disabled = (process.env.META_DISABLED ?? '').toLowerCase() === 'true';
  if (disabled) {
    return {
      accessToken: 'mock',
      phoneNumberId: 'mock',
      apiVersion: process.env.META_API_VERSION ?? DEFAULT_API_VERSION,
      disabled: true,
    };
  }

  const accessToken = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  if (!accessToken) {
    throw new Error(
      'META_ACCESS_TOKEN ausente — configure no .env.local ou ative META_DISABLED=true para mock.',
    );
  }
  if (!phoneNumberId) {
    throw new Error(
      'META_PHONE_NUMBER_ID ausente — configure no .env.local ou ative META_DISABLED=true para mock.',
    );
  }

  return {
    accessToken,
    phoneNumberId,
    apiVersion: process.env.META_API_VERSION ?? DEFAULT_API_VERSION,
    disabled: false,
  };
}

/** Normaliza telefone E.164: remove `+`, espaços, traços, parênteses. */
function normalizePhone(input: string): string {
  return input.replace(/[\s+\-()]/g, '');
}

function buildSendTemplatePayload(input: SendTemplateInput): MetaSendMessageRequest {
  const components: NonNullable<MetaSendMessageRequest['template']['components']> = [];

  if (input.headerImageUrl) {
    components.push({
      type: 'header',
      parameters: [{ type: 'image', image: { link: input.headerImageUrl } }],
    });
  }

  if (input.bodyParams && input.bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: input.bodyParams.map((text) => ({ type: 'text', text })),
    });
  }

  return {
    messaging_product: 'whatsapp',
    to: normalizePhone(input.to),
    type: 'template',
    template: {
      name: input.templateName,
      language: { code: input.languageCode },
      ...(components.length > 0 ? { components } : {}),
    },
  };
}

async function postToMeta(
  config: MetaClientConfig,
  payload: MetaSendMessageRequest,
): Promise<MetaSendMessageResponse> {
  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw MetaApiError.fromNetworkError('timeout');
    }
    throw MetaApiError.fromNetworkError(err instanceof Error ? err.message : 'unknown');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let body: MetaApiErrorResponse | undefined;
    try {
      body = (await response.json()) as MetaApiErrorResponse;
    } catch {
      // resposta não-JSON
    }
    if (body?.error) {
      throw MetaApiError.fromMetaResponse(response.status, body);
    }
    if (response.status >= 500) {
      throw MetaApiError.fromNetworkError(`http_${response.status}`);
    }
    throw new MetaApiError({
      code: 0,
      httpStatus: response.status,
      message: `Resposta Meta sem corpo de erro (HTTP ${response.status})`,
      retriable: response.status >= 500,
    });
  }

  return (await response.json()) as MetaSendMessageResponse;
}

export interface MetaWhatsAppClient {
  sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult>;
  isMock(): boolean;
}

class RealMetaClient implements MetaWhatsAppClient {
  constructor(private readonly config: MetaClientConfig) {}

  isMock(): boolean {
    return this.config.disabled;
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult> {
    if (this.config.disabled) {
      const mockId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      return { wamid: mockId, mock: true };
    }

    const payload = buildSendTemplatePayload(input);
    const response = await postToMeta(this.config, payload);
    const wamid = response.messages?.[0]?.id;
    if (!wamid) {
      throw new Error('Resposta Meta sem `messages[0].id`');
    }
    return { wamid };
  }
}

const globalForMeta = globalThis as unknown as { __metaClient?: MetaWhatsAppClient };

export function getMetaClient(): MetaWhatsAppClient {
  if (globalForMeta.__metaClient) return globalForMeta.__metaClient;
  const client = new RealMetaClient(loadConfig());
  if (process.env.NODE_ENV !== 'production') {
    globalForMeta.__metaClient = client;
  }
  return client;
}

/** Reseta o singleton — uso EXCLUSIVO em testes. */
export function __resetMetaClientForTests(): void {
  globalForMeta.__metaClient = undefined;
}

/** Helper conveniente — usa o singleton. */
export async function sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult> {
  return getMetaClient().sendTemplate(input);
}

// Helpers exportados pra teste unitário
export const __testing__ = {
  buildSendTemplatePayload,
  normalizePhone,
};
