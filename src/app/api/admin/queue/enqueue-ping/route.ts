import { NextResponse } from 'next/server';
import { getTenantContext } from '@/server/middleware/tenant';
import { isTenantError, UnauthorizedError } from '@/server/errors';
import { enqueue } from '@/lib/queue/queues';
import { PING_JOB_NAME, type PingPayload } from '@/lib/queue/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Endpoint admin pra enfileirar job ping (smoke / debug).
 *
 * Auth: somente super_admin (princípio do menor privilégio).
 * Endpoint NÃO existe em produção — adicionar guard via NODE_ENV ou
 * remover na story 8.4.
 */
export async function POST(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (ctx.kind !== 'super_admin') {
      // Reutiliza padrão de erro tenant — porteiros/admins normais não podem usar
      throw new UnauthorizedError('Apenas super_admin pode enfileirar jobs admin');
    }

    let body: { message?: string } = {};
    try {
      body = (await req.json()) as { message?: string };
    } catch {
      // body opcional
    }

    const payload: PingPayload = {
      message: body.message ?? 'hello from /api/admin/queue/enqueue-ping',
    };

    const result = await enqueue(PING_JOB_NAME, payload);

    return NextResponse.json({
      ok: true,
      job_id: result.id,
      job_name: result.name,
      queue: result.queue,
      payload,
    });
  } catch (err) {
    if (isTenantError(err)) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    console.error('[admin/queue/enqueue-ping] erro inesperado', err);
    return NextResponse.json({ ok: false, code: 'internal_error' }, { status: 500 });
  }
}
