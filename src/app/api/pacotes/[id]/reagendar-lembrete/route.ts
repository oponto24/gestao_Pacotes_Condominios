import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loggerForRequest } from '@/lib/logger';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError, NotFoundError } from '@/server/errors';
import { withTenantContext } from '@/server/db-tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const inputSchema = z.object({
  proximo_lembrete_em: z.string().datetime({ message: 'Data inválida' }),
});

/**
 * POST /api/pacotes/{id}/reagendar-lembrete (admin_master only).
 * Body: { proximo_lembrete_em: ISO datetime }
 *
 * Decisão produto 2026-05-09: quando morador responde WhatsApp, lembretes
 * são pausados automaticamente. Admin master reagenda manualmente via este
 * endpoint — escolhe a data/hora exata da próxima notificação.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = loggerForRequest(req).child({ scope: 'pacotes:reagendar-lembrete' });
  try {
    const ctx = await requireAdminMaster();
    const { id: pacoteId } = await params;

    const body = await req.json().catch(() => null);
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }

    const proximo = new Date(parsed.data.proximo_lembrete_em);
    if (proximo.getTime() < Date.now()) {
      throw new ValidationError('Data deve ser futura');
    }

    const result = await withTenantContext(ctx, async (tx) => {
      const pacote = await tx.pacote.findFirst({
        where: { id: pacoteId },
        select: { id: true, status: true },
      });
      if (!pacote) throw new NotFoundError('Pacote não encontrado');
      if (pacote.status !== 'aguardando_retirada') {
        throw new ValidationError(
          `Pacote em status "${pacote.status}" — só reagenda lembrete em aguardando_retirada`,
        );
      }

      await tx.pacote.update({
        where: { id: pacoteId },
        data: {
          proximo_lembrete_em: proximo,
          lembretes_pausados: false,
          lembretes_pausados_em: null,
          lembretes_pausados_motivo: null,
        },
      });

      return { pacote_id: pacoteId, proximo_lembrete_em: proximo.toISOString() };
    });

    log.info(
      { pacote_id: pacoteId, user_id: ctx.userId, proximo: parsed.data.proximo_lembrete_em },
      'Lembrete reagendado',
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
