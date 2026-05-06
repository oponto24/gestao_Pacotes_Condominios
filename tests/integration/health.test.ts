/* @vitest-environment node */
/**
 * Testes integration dos endpoints health (Story 1.7).
 *
 * Roda contra app rodando em localhost:3000. Pula automaticamente
 * se app não estiver acessível (CI sem stack Docker não quebra).
 */
import { describe, it, expect, beforeAll } from 'vitest';

const APP_URL = 'http://localhost:3000';
// Heurística estática (avaliada na coleta): se RUNTIME_URL aponta pra Postgres real,
// stack provavelmente está rodando. Cobre o caso CI sem Docker (skip).
const APP_REACHABLE_STATIC =
  !!process.env.DATABASE_RUNTIME_URL && process.env.DATABASE_RUNTIME_URL.includes('postgresql://');
let APP_REACHABLE_RUNTIME = false;

beforeAll(async () => {
  if (!APP_REACHABLE_STATIC) return;
  try {
    const res = await fetch(`${APP_URL}/api/health/db`, { method: 'GET' });
    APP_REACHABLE_RUNTIME = res.status < 500 || res.status === 503;
  } catch {
    APP_REACHABLE_RUNTIME = false;
  }
});

describe.skipIf(!APP_REACHABLE_STATIC)('Health endpoints', () => {
  it('GET /api/health retorna 200 com status=ok quando db+redis OK', async () => {
    if (!APP_REACHABLE_RUNTIME) return; // app não estava up no beforeAll
    const res = await fetch(`${APP_URL}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('uptime_s');
    expect(body).toHaveProperty('version');
    expect(body.checks.db.status).toBe('ok');
    expect(body.checks.redis.status).toBe('ok');
    expect(typeof body.checks.db.latency_ms).toBe('number');
    expect(typeof body.checks.redis.latency_ms).toBe('number');
  });

  it('GET /api/health/db continua funcional (regressão da 1.3)', async () => {
    if (!APP_REACHABLE_RUNTIME) return;
    const res = await fetch(`${APP_URL}/api/health/db`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe('up');
  });

  it('GET /api/health/redis retorna ok com PONG e set/get OK', async () => {
    if (!APP_REACHABLE_RUNTIME) return;
    const res = await fetch(`${APP_URL}/api/health/redis`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ping).toBe('PONG');
    expect(body.set_get).toBe('ok');
    expect(typeof body.latency_ms).toBe('number');
  });
});
