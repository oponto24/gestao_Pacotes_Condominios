import { NextResponse } from 'next/server';
import { checkDb, checkRedis, aggregateStatus } from '@/lib/health';

// Próxima evolução: Dockerfile passa --build-arg APP_VERSION=... e setamos
// como ENV no stage runner. Por ora cai no fallback 'dev'. Evita warning
// Next 15 sobre import direto do package.json (que copia tudo pro bundle).
const version = process.env.APP_VERSION ?? 'dev';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  // Roda checks em paralelo pra minimizar latência total
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);

  const checks = { db, redis };
  const status = aggregateStatus(checks);

  const body = {
    status,
    uptime_s: Math.floor(process.uptime()),
    version,
    checks,
    timestamp: new Date().toISOString(),
  };

  // 200 quando ok; 503 em qualquer falha (degraded ou down) — UptimeRobot interpreta 5xx como DOWN
  const httpStatus = status === 'ok' ? 200 : 503;
  return NextResponse.json(body, { status: httpStatus });
}
