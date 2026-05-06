/* @vitest-environment node */
/**
 * Testes integration BullMQ — Story 1.8
 *
 * Cria Worker em-process (não depende do container worker) pra validar
 * enqueue → process round-trip.
 *
 * Cobertura:
 *   1. Enqueue → process completes (resultado retornado)
 *   2. Job inválido (name desconhecido) → vai pra failed
 *   3. Idempotência por jobId — dois enqueues do mesmo jobId não duplicam
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { processPing, type PingPayload, type PingResult } from '@/lib/queue/jobs/ping';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const REDIS_REACHABLE = !!process.env.REDIS_URL && process.env.REDIS_URL.includes('redis://');

const TEST_QUEUE = `test-bullmq-${Date.now()}`;

let redis: IORedis;
let queue: Queue;
let worker: Worker;

beforeAll(async () => {
  if (!REDIS_REACHABLE) return;
  redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  queue = new Queue(TEST_QUEUE, { connection: redis });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worker = new Worker(
    TEST_QUEUE,
    async (job: Job<PingPayload>) => {
      if (job.name === 'ping') return processPing(job);
      throw new Error(`unknown job name: ${job.name}`);
    },
    { connection: redis, concurrency: 5 },
  );

  // Aguarda worker estar ready (evita race condition no 1º teste)
  await new Promise<void>((resolve) => {
    if (worker.isRunning()) return resolve();
    worker.once('ready', () => resolve());
  });
});

afterAll(async () => {
  if (REDIS_REACHABLE) {
    await worker?.close();
    await queue?.obliterate({ force: true }).catch(() => {});
    await queue?.close();
    await redis?.quit();
  }
});

describe.skipIf(!REDIS_REACHABLE)('BullMQ queue', () => {
  it('enqueue ping → process completes com resultado correto', async () => {
    const message = `test-${Date.now()}`;
    const job = await queue.add('ping', { message }, { attempts: 1 });

    // Aguarda completion via event listener (timeout 5s)
    const result = await new Promise<PingResult>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('completed timeout 5s')), 5_000);
      const onCompleted = (completedJob: Job, returnValue: PingResult) => {
        if (completedJob.id !== job.id) return;
        clearTimeout(timer);
        worker.off('completed', onCompleted);
        resolve(returnValue);
      };
      worker.on('completed', onCompleted);
    });

    expect(result.pong).toBe(true);
    expect(result.message_echo).toBe(message);
    expect(result).toHaveProperty('received_at');
    expect(result).toHaveProperty('processed_at');
  });

  it('job com name desconhecido vai pra failed', async () => {
    const job = await queue.add('unknown-job-name', { foo: 'bar' }, { attempts: 1 });

    const failedErr = await new Promise<Error>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('failed timeout 5s')), 5_000);
      const onFailed = (failedJob: Job | undefined, err: Error) => {
        if (failedJob?.id !== job.id) return;
        clearTimeout(timer);
        worker.off('failed', onFailed);
        resolve(err);
      };
      worker.on('failed', onFailed);
    });

    expect(failedErr.message).toMatch(/unknown job name/i);
  });

  it('idempotência via jobId: dois enqueues do mesmo jobId não duplicam', async () => {
    const jobId = `idempotent-${Date.now()}`;
    const job1 = await queue.add('ping', { message: 'first' }, { jobId, attempts: 1 });
    const job2 = await queue.add('ping', { message: 'second' }, { jobId, attempts: 1 });

    // BullMQ retorna o MESMO job se jobId já existe
    expect(job2.id).toBe(job1.id);

    // payload do segundo é IGNORADO (mantém o primeiro)
    const stored = await queue.getJob(jobId);
    expect(stored?.data.message).toBe('first');
  });
});
