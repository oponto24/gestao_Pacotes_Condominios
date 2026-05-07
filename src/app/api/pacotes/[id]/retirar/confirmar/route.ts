import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError, NotFoundError } from '@/server/errors';
import { retirarConfirmarSchema } from '@/lib/validators/retirar';
import { confirmarRetirada } from '@/lib/db/pacote-retirada';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PATCH /api/pacotes/{id}/retirar/confirmar (story 5.4)
 *
 * Marca pacote como retirado, invalida QR. Idempotente.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = loggerForRequest(req).child({ scope: 'pacotes:retirar:confirmar' });
  try {
    const ctx = await requirePorteiro();
    const { id: pacoteId } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Body inválido (JSON esperado)');
    }
    const parsed = retirarConfirmarSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }

    const result = await confirmarRetirada(ctx, pacoteId, parsed.data);
    log.info(
      { pacote_id: pacoteId, already_retirado: result.already_retirado },
      'Retirada confirmada',
    );
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 404 });
    }
    return handleApiError(err, log);
  }
}
