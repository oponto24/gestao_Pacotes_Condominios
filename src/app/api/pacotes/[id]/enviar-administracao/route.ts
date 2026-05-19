import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError, NotFoundError } from '@/server/errors';
import { parseIdParam } from '@/lib/validators/_shared';
import { enviarParaAdministracao } from '@/lib/db/pacote-administracao';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/pacotes/{id}/enviar-administracao (story 10.6).
 *
 * Transição `aguardando_retirada` → `em_administracao`. Aceita qualquer role
 * operacional (porteiro, admin_master, admin_funcionario) — flexibilidade
 * pra suprir ausências (FR-083).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = loggerForRequest(req).child({ scope: 'pacotes:enviar-administracao' });
  try {
    const ctx = await requirePorteiro();
    const pacoteId = parseIdParam((await params).id);
    if (!pacoteId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const result = await enviarParaAdministracao(ctx, pacoteId);

    log.info(
      {
        pacote_id: pacoteId,
        already_in_admin: result.already_in_admin,
        user_id: ctx.userId,
        role: ctx.role,
      },
      'Pacote enviado pra administração',
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
