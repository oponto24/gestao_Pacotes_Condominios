import type { Job } from 'bullmq';
import { processPing, PING_JOB_NAME } from './ping';
import { processExtractLabel, EXTRACT_LABEL_JOB_NAME } from './extract-label';
import { processSendWhatsApp, SEND_WHATSAPP_JOB_NAME } from './send-whatsapp';

/**
 * Registro central de processadores de jobs.
 * Adicione novos jobs aqui conforme stories futuras (3.5, 4.3, 7.2, 7.5).
 *
 * Padrão por job:
 *   1. Crie `src/lib/queue/jobs/<nome>.ts` com Payload, Result, NAME, processFn
 *   2. Adicione import + entrada no map abaixo
 *   3. Tipos automaticamente flow pelo Worker dispatcher (sem hardcode de strings)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProcessor = (job: Job<any>) => Promise<any>;

export const JOB_PROCESSORS: Record<string, AnyProcessor> = {
  [PING_JOB_NAME]: processPing,
  [EXTRACT_LABEL_JOB_NAME]: processExtractLabel,
  [SEND_WHATSAPP_JOB_NAME]: processSendWhatsApp,
};

export { PING_JOB_NAME, EXTRACT_LABEL_JOB_NAME, SEND_WHATSAPP_JOB_NAME };
export type { PingPayload, PingResult } from './ping';
export type { ExtractLabelPayload, ExtractLabelResult } from './extract-label';
export type { SendWhatsAppPayload, SendWhatsAppResult } from './send-whatsapp';
