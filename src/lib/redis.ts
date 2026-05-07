import IORedis, { type Redis } from 'ioredis';

/**
 * Redis client singleton (mesmo padrão de db.ts).
 *
 * - Lazy connect: não conecta no import, só na primeira query.
 * - Reusa conexão entre hot reloads via globalThis (evita warnings em dev).
 * - Em produção, módulos não recarregam — primeira instância vive pelo processo.
 *
 * Será reutilizado pelo BullMQ na story 1.8.
 */

const globalForRedis = globalThis as unknown as { redis?: Redis };

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis: Redis =
  globalForRedis.redis ??
  new IORedis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null, // requirement do BullMQ; pra app comum, não impacta
    enableReadyCheck: true,
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
