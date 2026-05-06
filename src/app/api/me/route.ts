import { NextResponse } from 'next/server';
import { getTenantContext } from '@/server/middleware/tenant';
import { isTenantError } from '@/server/errors';
import { loggerForRequest } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'api/me' });
  try {
    const ctx = await getTenantContext();
    return NextResponse.json(ctx);
  } catch (err) {
    if (isTenantError(err)) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    log.error({ err }, 'erro inesperado');
    return NextResponse.json({ ok: false, code: 'internal_error' }, { status: 500 });
  }
}
