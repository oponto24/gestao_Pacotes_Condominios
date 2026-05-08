import { enqueue } from './queues';
import { SEND_WHATSAPP_JOB_NAME, type SendWhatsAppPayload } from './jobs';

/**
 * Enfileira job sendWhatsApp com retry config padrão (story 4.3).
 *
 * 4 attempts total (1 envio + 3 retries) com backoff exponencial:
 * 5s → 10s → 20s → 40s. Total ~75s antes de marcar permanentemente failed.
 *
 * removeOnFail: false — mantém em fila pra inspeção via /admin (story 4.6).
 * jobId: usa pacote_id pra prevenir duplicatas em rajadas (BullMQ skip).
 */
export async function enqueueSendWhatsApp(payload: SendWhatsAppPayload) {
  return enqueue(SEND_WHATSAPP_JOB_NAME, payload, {
    attempts: 4,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: 1000,
    removeOnFail: false,
    // jobId determinístico — se já houver job pending pro mesmo pacote, BullMQ ignora
    jobId: `sendWhatsApp:${payload.pacote_id}`,
  });
}
