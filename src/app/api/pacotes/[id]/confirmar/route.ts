import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError, NotFoundError } from '@/server/errors';
import { parseIdParam } from '@/lib/validators/_shared';
import { pacoteConfirmarInputSchema } from '@/lib/validators/pacote-confirmar';
import { confirmarPacote } from '@/lib/db/pacote-confirmar';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PATCH /api/pacotes/{id}/confirmar (story 3.8).
 *
 * Confirma os dados extraídos pela IA (e potencialmente editados pelo porteiro).
 * Cria evento `confirmado`. Idempotente — segunda chamada retorna already_confirmed.
 *
 * Acesso: porteiro ou admin (substituição).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = loggerForRequest(req).child({ scope: 'pacotes:confirmar' });
  try {
    const ctx = await requirePorteiro();
    const pacoteId = parseIdParam((await params).id);
    if (!pacoteId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Body inválido (JSON esperado)');
    }

    const parsed = pacoteConfirmarInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }

    const result = await confirmarPacote(ctx, pacoteId, parsed.data);

    log.info(
      {
        pacote_id: pacoteId,
        already_confirmed: result.already_confirmed,
        user_id: ctx.userId,
      },
      'Pacote confirmado',
    );

    return NextResponse.json(
      { ok: true, ...result },
      { status: result.already_confirmed ? 200 : 200 },
    );
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        { ok: false, message: err.message },
        { status: 404 },
      );
    }
    return handleApiError(err, log);
  }
}
