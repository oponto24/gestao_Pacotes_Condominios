import { NextResponse } from 'next/server';
import { checkDb } from '@/lib/health';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEALTH_SECRET = process.env.HEALTH_SECRET;

/**
 * Endpoint legado (story 1.3) — protegido contra info disclosure.
 * Requer Bearer token para detalhes. Sem auth → 401.
 */
export async function GET(req: Request) {
  if (!HEALTH_SECRET || req.headers.get('authorization') !== `Bearer ${HEALTH_SECRET}`) {
    return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 });
  }

  const result = await checkDb();
  if (result.status === 'ok') {
    return NextResponse.json({ ok: true, db: 'up', latency_ms: result.latency_ms });
  }
  return NextResponse.json(
    { ok: false, db: 'down', error: result.error },
    { status: 503 },
  );
}
