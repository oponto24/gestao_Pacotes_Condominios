import { redis } from '@/lib/redis';

/**
 * Conexão BullMQ — reusa o cliente ioredis singleton (story 1.7)
 * que já está configurado com `maxRetriesPerRequest: null` (requirement BullMQ).
 *
 * Pool compartilhado entre app (enqueue) e worker (consume) evita N conexões.
 */
export const queueConnection = redis;

/**
 * Defaults pra todos os jobs enfileirados na app:
 * - 3 tentativas (1ª + 2 retries)
 * - backoff exponencial 1s, 2s, 4s
 * - garbage collection: completed após 1h ou últimos 100 (o que vier primeiro)
 * - failed: mantém 24h pra debug
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1_000,
  },
  removeOnComplete: { age: 3600, count: 100 },
  removeOnFail: { age: 86_400 },
};

/**
 * Defaults do Worker:
 * - 5 jobs paralelos por processo (suficiente pra MVP)
 * - lock 60s (job pode demorar até 60s antes de outro worker pegar)
 */
export const WORKER_DEFAULTS = {
  concurrency: 5,
  lockDuration: 60_000,
};
