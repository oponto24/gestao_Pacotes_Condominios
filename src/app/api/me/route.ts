import { NextResponse } from 'next/server';
import { getTenantContext } from '@/server/middleware/tenant';
import { isTenantError } from '@/server/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
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
    console.error('[api/me] erro inesperado', err);
    return NextResponse.json({ ok: false, code: 'internal_error' }, { status: 500 });
  }
}
