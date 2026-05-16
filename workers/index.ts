import { Worker, type Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { JOB_PROCESSORS, ENVIAR_LEMBRETES_JOB_NAME, EXPIRAR_PALAVRAS_CHAVE_JOB_NAME } from '@/lib/queue/jobs';
import { DEFAULT_QUEUE_NAME, defaultQueue } from '@/lib/queue/queues';
import { WORKER_DEFAULTS } from '@/lib/queue/connection';
import { logger, loggerForJob } from '@/lib/logger';

/**
 * Worker BullMQ — substitui o placeholder da story 1.2.
 *
 * Despacha jobs por `job.name` para os processadores registrados em
 * JOB_PROCESSORS (src/lib/queue/jobs/index.ts). Adicionar novo job =
 * adicionar entrada no map, sem mudar este arquivo.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dispatcher(job: Job<any>) {
  const processor = JOB_PROCESSORS[job.name];
  if (!processor) {
    throw new Error(`No processor registered for job name "${job.name}"`);
  }
  return processor(job);
}

logger.info(
  { fila: DEFAULT_QUEUE_NAME, pid: process.pid, jobs: Object.keys(JOB_PROCESSORS) },
  '[worker] iniciando',
);

const worker = new Worker(DEFAULT_QUEUE_NAME, dispatcher, {
  connection: redis,
  concurrency: WORKER_DEFAULTS.concurrency,
  lockDuration: WORKER_DEFAULTS.lockDuration,
});

worker.on('completed', (job) => {
  loggerForJob(job).info('completed');
});

worker.on('failed', (job, err) => {
  if (!job) {
    logger.error({ err: err.message }, '[worker] failed sem job');
    return;
  }
  loggerForJob(job).error(
    {
      attempt: job.attemptsMade,
      max_attempts: job.opts.attempts,
      err: err.message,
    },
    'failed',
  );
});

worker.on('error', (err) => {
  logger.error({ err: err.message }, '[worker] error');
});

// Graceful shutdown — espera jobs em-vôo terminarem antes de sair
const shutdown = async (signal: string) => {
  logger.info({ signal }, '[worker] encerrando');
  try {
    // 30s pra finalizar jobs em-vôo. Se exceder, o orchestrator (Docker/SIGKILL)
    // mata o processo.
    await Promise.race([
      worker.close(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('worker.close() timeout 30s')), 30_000),
      ),
    ]);
    await redis.quit();
    logger.info('[worker] encerrado limpo');
    process.exit(0);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, '[worker] erro durante shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// --- Repeatable jobs (cron) ---
// BullMQ deduplicates by jobId pattern — safe to call on every boot.
(async () => {
  try {
    // Lembretes WhatsApp a cada 1h (story 4.6b decisao 2026-05-09)
    await defaultQueue.add(ENVIAR_LEMBRETES_JOB_NAME, {}, {
      repeat: { pattern: '0 * * * *' },
      jobId: 'cron:enviarLembretes',
    });

    // Expirar palavras-chave diariamente as 06:00 UTC (story 7.5)
    await defaultQueue.add(EXPIRAR_PALAVRAS_CHAVE_JOB_NAME, {}, {
      repeat: { pattern: '0 6 * * *' },
      jobId: 'cron:expirarPalavrasChave',
    });

    logger.info('[worker] repeatable jobs registrados (lembretes 1h, expiracao 06:00 UTC)');
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, '[worker] falha ao registrar repeatable jobs');
  }
})();
