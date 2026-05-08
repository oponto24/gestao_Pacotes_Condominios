/**
 * Tipos da Meta WhatsApp Cloud API.
 * Doc: https://developers.facebook.com/docs/whatsapp/cloud-api/reference
 */

export interface SendTemplateInput {
  /** Telefone E.164 sem `+` (ex: `5511999999999`). `+` será removido se presente. */
  to: string;
  /** Nome do template aprovado pela Meta (ex: `pacote_chegou`). */
  templateName: string;
  /** Código de idioma do template (ex: `pt_BR`, `en_US`). */
  languageCode: string;
  /** URL pública absoluta da imagem de cabeçalho. Se omitido, template não envia header. */
  headerImageUrl?: string;
  /** Variáveis do corpo na ordem `{{1}}, {{2}}, ...` */
  bodyParams?: string[];
}

export interface SendTemplateResult {
  /** `wamid` retornado pela Meta — id único da mensagem. */
  wamid: string;
  /** True se a chamada foi simulada (modo `META_DISABLED=true`). */
  mock?: boolean;
}

interface TemplateComponentParameter {
  type: 'text' | 'image';
  text?: string;
  image?: { link: string };
}

interface TemplateComponent {
  type: 'header' | 'body';
  parameters: TemplateComponentParameter[];
}

export interface MetaSendMessageRequest {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: TemplateComponent[];
  };
}

export interface MetaSendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
}

export interface MetaApiErrorResponse {
  error: {
    message: string;
    type?: string;
    code: number;
    error_subcode?: number;
    error_data?: { details?: string };
    fbtrace_id?: string;
  };
}
