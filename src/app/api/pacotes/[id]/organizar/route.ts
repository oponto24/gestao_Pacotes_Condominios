import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError, NotFoundError } from '@/server/errors';
import { pacoteOrganizarInputSchema } from '@/lib/validators/pacote-organizar';
import { organizarPacote } from '@/lib/db/pacote-organizar';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PATCH /api/pacotes/{id}/organizar (story 3.9).
 *
 * Define tamanho + setor + posição. Status vira `aguardando_retirada`.
 * Idempotente.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = loggerForRequest(req).child({ scope: 'pacotes:organizar' });
  try {
    const ctx = await requirePorteiro();
    const { id: pacoteId } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Body inválido (JSON esperado)');
    }

    const parsed = pacoteOrganizarInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }

    const result = await organizarPacote(ctx, pacoteId, parsed.data);

    log.info(
      { pacote_id: pacoteId, already_organized: result.already_organized },
      'Pacote organizado',
    );

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
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
