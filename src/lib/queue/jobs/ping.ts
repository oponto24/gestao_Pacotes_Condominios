import type { Job } from 'bullmq';

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
  const received_at = new Date().toISOString();
  console.log(
    `[ping] processing job=${job.id} message="${job.data.message}" received_at=${received_at}`,
  );

  // Sem trabalho real — só eco
  const result: PingResult = {
    pong: true,
    received_at,
    processed_at: new Date().toISOString(),
    message_echo: job.data.message,
  };

  console.log(`[ping] processed job=${job.id} pong=true`);
  return result;
}
