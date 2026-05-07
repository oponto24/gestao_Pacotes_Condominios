import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

export type CheckStatus = 'ok' | 'down';
export type CheckResult = {
  status: CheckStatus;
  latency_ms: number;
  error?: string;
};

const DEFAULT_TIMEOUT_MS = 3_000;

/**
 * Promise.race com timeout — rejeita se demorar mais que `ms`.
 * Garante que health endpoints nunca travem mais que `ms`.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Categoriza erro sem vazar detalhes sensíveis (connection string, query, etc).
 */
function categorizeError(err: unknown): string {
  if (!(err instanceof Error)) return 'unknown';
  const msg = err.message.toLowerCase();
  if (msg.includes('timeout')) return 'timeout';
  if (msg.includes('econnrefused') || msg.includes('connection refused')) return 'connection_refused';
  if (msg.includes('enotfound') || msg.includes('getaddrinfo')) return 'dns_error';
  if (msg.includes('authentication') || msg.includes('password')) return 'auth_failed';
  return 'error';
}

export async function checkDb(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<CheckResult> {
  const start = Date.now();
  try {
    await withTimeout(db.$queryRaw`SELECT 1`, timeoutMs, 'db');
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    return {
      status: 'down',
      latency_ms: Date.now() - start,
      error: categorizeError(err),
    };
  }
}

export async function checkRedis(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<CheckResult> {
  const start = Date.now();
  try {
    const reply = await withTimeout(redis.ping(), timeoutMs, 'redis');
    if (reply !== 'PONG') {
      return {
        status: 'down',
        latency_ms: Date.now() - start,
        error: `unexpected_reply:${reply}`,
      };
    }
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    return {
      status: 'down',
      latency_ms: Date.now() - start,
      error: categorizeError(err),
    };
  }
}

export type AggregateStatus = 'ok' | 'degraded' | 'down';

/**
 * Deriva status agregado a partir de N checks.
 *   - todos ok → 'ok'
 *   - todos down → 'down'
 *   - alguns down → 'degraded'
 */
export function aggregateStatus(checks: Record<string, CheckResult>): AggregateStatus {
  const values = Object.values(checks);
  if (values.length === 0) return 'down';
  const downCount = values.filter((c) => c.status === 'down').length;
  if (downCount === 0) return 'ok';
  if (downCount === values.length) return 'down';
  return 'degraded';
}
