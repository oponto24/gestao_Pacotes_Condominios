import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError, NotFoundError } from '@/server/errors';
import { withTenantContext } from '@/server/db-tenant';
import { enqueueSendWhatsApp } from '@/lib/queue/enqueue-send-whatsapp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_REENVIOS_HOURLY = 3;

/**
 * POST /api/pacotes/{id}/reenviar-whatsapp (story 4.6).
 *
 * Reenfileira sendWhatsApp manualmente. Rate limit: 3 reenvios/hora por pacote.
 * Auth: porteiro ou admin do mesmo condomínio do pacote.
 *
 * jobId é único por timestamp pra forçar nova execução (sem dedupe do enqueueSendWhatsApp default).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = loggerForRequest(req).child({ scope: 'pacotes:reenviar-whatsapp' });
  try {
    const ctx = await requirePorteiro();
    const { id: pacoteId } = await params;

    const result = await withTenantContext(ctx, async (tx) => {
      const pacote = await tx.pacote.findFirst({
        where: { id: pacoteId },
        select: { id: true, status: true, condominio_id: true },
      });
      if (!pacote) throw new NotFoundError('Pacote não encontrado');
      if (pacote.status !== 'aguardando_retirada') {
        throw new ValidationError(
          `Pacote em status "${pacote.status}" — só pode reenviar em "aguardando_retirada"`,
        );
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = await tx.whatsAppMessage.count({
        where: {
          pacote_id: pacoteId,
          direction: 'outbound',
          created_at: { gte: oneHourAgo },
        },
      });

      if (recentCount >= MAX_REENVIOS_HOURLY) {
        return { rateLimited: true as const, count: recentCount };
      }

      return { rateLimited: false as const, condominio_id: pacote.condominio_id };
    });

    if (result.rateLimited) {
      return NextResponse.json(
        {
          ok: false,
          message: `Limite de ${MAX_REENVIOS_HOURLY} reenvios/hora atingido (${result.count} já enviados)`,
        },
        { status: 429 },
      );
    }

    const job = await enqueueSendWhatsApp(
      { pacote_id: pacoteId, condominio_id: result.condominio_id },
      { forceUnique: true },
    );

    log.info({ pacote_id: pacoteId, user_id: ctx.userId, job_id: job.id }, 'Reenvio WhatsApp manual');

    return NextResponse.json({ ok: true, job_id: job.id }, { status: 200 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 404 });
    }
    return handleApiError(err, log);
  }
}
