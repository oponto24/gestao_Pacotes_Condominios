import crypto from 'node:crypto';

/**
 * Tipos do payload de webhook Meta WhatsApp Cloud API.
 * Doc: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */
export interface MetaWebhookValue {
  messaging_product?: string;
  metadata?: { display_phone_number: string; phone_number_id: string };
  contacts?: Array<{ profile: { name: string }; wa_id: string }>;
  messages?: Array<MetaInboundMessage>;
  statuses?: Array<MetaStatusUpdate>;
}

export interface MetaInboundMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

export interface MetaStatusUpdate {
  id: string; // wamid
  recipient_id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  errors?: Array<{ code: number; title: string; message?: string }>;
}

export interface MetaWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: MetaWebhookValue;
      field: string;
    }>;
  }>;
}

/**
 * Valida assinatura HMAC-SHA256 do header `x-hub-signature-256`.
 * Body deve ser o texto bruto recebido (não parseado).
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const received = signatureHeader.slice('sha256='.length);
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  // Comparação timing-safe — buffers precisam ter mesmo length antes
  if (received.length !== expected.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
