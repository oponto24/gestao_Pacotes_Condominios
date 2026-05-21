/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock health checks
vi.mock('@/lib/health', () => ({
  checkDb: vi.fn().mockResolvedValue({ status: 'ok', latency_ms: 5 }),
  checkRedis: vi.fn().mockResolvedValue({ status: 'ok', latency_ms: 3 }),
  aggregateStatus: vi.fn().mockReturnValue('ok'),
}));

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns only status without auth', async () => {
    const { GET } = await import('@/app/api/health/route');
    const req = new Request('http://localhost:3000/api/health');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.version).toBeUndefined();
    expect(body.uptime_s).toBeUndefined();
    expect(body.checks).toBeUndefined();
  });

  it('returns full details with valid auth', async () => {
    process.env.HEALTH_SECRET = 'test-secret-123';
    vi.resetModules();

    // Re-mock after resetModules
    vi.doMock('@/lib/health', () => ({
      checkDb: vi.fn().mockResolvedValue({ status: 'ok', latency_ms: 5 }),
      checkRedis: vi.fn().mockResolvedValue({ status: 'ok', latency_ms: 3 }),
      aggregateStatus: vi.fn().mockReturnValue('ok'),
    }));

    const { GET } = await import('@/app/api/health/route');
    const req = new Request('http://localhost:3000/api/health', {
      headers: { Authorization: 'Bearer test-secret-123' },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    expect(body.uptime_s).toBeDefined();
    expect(body.checks).toBeDefined();

    delete process.env.HEALTH_SECRET;
  });
});
