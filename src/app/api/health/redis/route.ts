import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEALTH_KEY = 'health:test';
const HEALTH_SECRET = process.env.HEALTH_SECRET;

export async function GET(req: Request) {
  if (!HEALTH_SECRET || req.headers.get('authorization') !== `Bearer ${HEALTH_SECRET}`) {
    return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  try {
    const ping = await redis.ping();
    if (ping !== 'PONG') {
      return NextResponse.json(
        { ok: false, ping, error: 'unexpected_ping_reply' },
        { status: 503 },
      );
    }

    await redis.set(HEALTH_KEY, '1', 'EX', 5);
    const value = await redis.get(HEALTH_KEY);

    return NextResponse.json({
      ok: true,
      ping: 'PONG',
      set_get: value === '1' ? 'ok' : 'fail',
      latency_ms: Date.now() - start,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.split('\n')[0] : 'unknown';
    return NextResponse.json(
      { ok: false, error: message, latency_ms: Date.now() - start },
      { status: 503 },
    );
  }
}
