import { NextResponse } from 'next/server';
import { checkDb } from '@/lib/health';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Endpoint legado (story 1.3) — mantido por retrocompatibilidade.
 * Para status agregado de todos os componentes use `/api/health` (story 1.7).
 */
export async function GET() {
  const result = await checkDb();
  if (result.status === 'ok') {
    return NextResponse.json({ ok: true, db: 'up', latency_ms: result.latency_ms });
  }
  return NextResponse.json(
    { ok: false, db: 'down', error: result.error },
    { status: 503 },
  );
}
