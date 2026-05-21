import { NextResponse } from 'next/server';
import { checkDb, checkRedis, aggregateStatus } from '@/lib/health';

const version = process.env.APP_VERSION ?? 'dev';
const HEALTH_SECRET = process.env.HEALTH_SECRET;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAuthorized(req: Request): boolean {
  if (!HEALTH_SECRET) return false;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${HEALTH_SECRET}`;
}

export async function GET(req: Request) {
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);

  const checks = { db, redis };
  const status = aggregateStatus(checks);
  const httpStatus = status === 'ok' ? 200 : 503;

  // Public: minimal response
  if (!isAuthorized(req)) {
    return NextResponse.json({ status }, { status: httpStatus });
  }

  // Authenticated: full details
  return NextResponse.json(
    {
      status,
      uptime_s: Math.floor(process.uptime()),
      version,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: httpStatus },
  );
}
