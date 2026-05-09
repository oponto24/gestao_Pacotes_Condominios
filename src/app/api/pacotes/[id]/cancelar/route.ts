import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError, NotFoundError } from '@/server/errors';
import { cancelarPacote } from '@/lib/db/pacote-cancelar';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/pacotes/{id}/cancelar — admin_master only.
 * Body: { motivo: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = loggerForRequest(req).child({ scope: 'pacotes:cancelar' });
  try {
    const ctx = await requireAdminMaster();
    const { id: pacoteId } = await params;

    const body = (await req.json().catch(() => null)) as { motivo?: string } | null;
    if (!body || typeof body.motivo !== 'string') {
      throw new ValidationError('Body inválido — campo `motivo` obrigatório');
    }

    const result = await cancelarPacote(ctx, pacoteId, body.motivo);

    log.info(
      { pacote_id: pacoteId, user_id: ctx.userId, already_canceled: result.already_canceled },
      'Pacote cancelado',
    );

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 404 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 422 });
    }
    return handleApiError(err, log);
  }
}
