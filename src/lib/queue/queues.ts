import { Queue, type JobsOptions } from 'bullmq';
import { queueConnection, DEFAULT_JOB_OPTIONS } from './connection';

export const DEFAULT_QUEUE_NAME = 'default' as const;

/**
 * Fila padrão. No MVP usamos só essa.
 * Quando virar dor (ex: WhatsApp não pode esperar IA), adicionar filas
 * separadas com prioridade própria.
 */
export const defaultQueue = new Queue(DEFAULT_QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Helper pra enfileirar jobs com tipagem básica.
 * Aceita opts (override) sobre `DEFAULT_JOB_OPTIONS`.
 *
 * Para idempotência, passe `opts.jobId` — BullMQ não duplica.
 */
export async function enqueue<TPayload>(
  jobName: string,
  payload: TPayload,
  opts?: JobsOptions,
) {
  const job = await defaultQueue.add(jobName, payload, opts);
  return { id: job.id!, name: jobName, queue: DEFAULT_QUEUE_NAME };
}
