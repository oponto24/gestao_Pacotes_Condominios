import { Worker, type Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { JOB_PROCESSORS } from '@/lib/queue/jobs';
import { DEFAULT_QUEUE_NAME } from '@/lib/queue/queues';
import { WORKER_DEFAULTS } from '@/lib/queue/connection';

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

console.log(`[worker] iniciando — fila=${DEFAULT_QUEUE_NAME} pid=${process.pid}`);
console.log(`[worker] jobs registrados: ${Object.keys(JOB_PROCESSORS).join(', ')}`);

const worker = new Worker(DEFAULT_QUEUE_NAME, dispatcher, {
  connection: redis,
  concurrency: WORKER_DEFAULTS.concurrency,
  lockDuration: WORKER_DEFAULTS.lockDuration,
});

worker.on('completed', (job) => {
  console.log(`[worker] completed name=${job.name} id=${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(
    `[worker] failed name=${job?.name} id=${job?.id} attempt=${job?.attemptsMade}/${job?.opts.attempts} error="${err.message}"`,
  );
});

worker.on('error', (err) => {
  console.error('[worker] error', err);
});

// Graceful shutdown — espera jobs em-vôo terminarem antes de sair
const shutdown = async (signal: string) => {
  console.log(`[worker] recebido ${signal}, encerrando…`);
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
    console.log('[worker] encerrado limpo.');
    process.exit(0);
  } catch (err) {
    console.error('[worker] erro durante shutdown', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
