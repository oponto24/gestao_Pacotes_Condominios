import { enqueue } from './queues';
import { SEND_WHATSAPP_JOB_NAME, type SendWhatsAppPayload } from './jobs';

export interface EnqueueSendWhatsAppOptions {
  /**
   * Se true, força jobId único por timestamp (não deduplica).
   * Usado pelo reenvio manual (story 4.6) que precisa criar nova mensagem
   * mesmo se já houver job no mesmo pacote.
   */
  forceUnique?: boolean;
}

/**
 * Enfileira job sendWhatsApp com retry config padrão (story 4.3).
 *
 * 4 attempts total (1 envio + 3 retries) com backoff exponencial:
 * 5s → 10s → 20s → 40s. Total ~75s antes de marcar permanentemente failed.
 *
 * removeOnFail: false — mantém em fila pra inspeção via /admin (story 4.6).
 * jobId: por padrão determinístico (anti-duplicação). `forceUnique=true` ignora
 * pra permitir reenvio manual.
 */
export async function enqueueSendWhatsApp(
  payload: SendWhatsAppPayload,
  options: EnqueueSendWhatsAppOptions = {},
) {
  const jobId = options.forceUnique
    ? `sendWhatsApp:${payload.pacote_id}:${Date.now()}`
    : `sendWhatsApp:${payload.pacote_id}`;

  return enqueue(SEND_WHATSAPP_JOB_NAME, payload, {
    attempts: 4,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: 1000,
    removeOnFail: false,
    jobId,
  });
}
