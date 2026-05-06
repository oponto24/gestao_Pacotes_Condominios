import type { Job } from 'bullmq';
import { loggerForJob } from '@/lib/logger';

export type PingPayload = {
  message: string;
};

export type PingResult = {
  pong: true;
  received_at: string;
  processed_at: string;
  message_echo: string;
};

export const PING_JOB_NAME = 'ping' as const;

/**
 * Job de teste end-to-end: ecoa a mensagem com timestamps.
 * Usado pra validar enqueue → process round-trip.
 *
 * NÃO usa tenant context (apenas eco). Quando próximas stories adicionarem
 * jobs com escrita no DB tenant-scoped, devem usar `withTenantContext` —
 * ver pattern em `docs/runbooks/jobs.md`.
 */
export async function processPing(job: Job<PingPayload>): Promise<PingResult> {
  const log = loggerForJob(job);
  const received_at = new Date().toISOString();
  log.info({ message: job.data.message, received_at }, '[ping] processing');

  // Sem trabalho real — só eco
  const result: PingResult = {
    pong: true,
    received_at,
    processed_at: new Date().toISOString(),
    message_echo: job.data.message,
  };

  log.info('[ping] processed');
  return result;
}
