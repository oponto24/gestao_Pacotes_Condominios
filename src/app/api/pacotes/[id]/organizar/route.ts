import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError, NotFoundError } from '@/server/errors';
import { parseIdParam } from '@/lib/validators/_shared';
import { pacoteOrganizarInputSchema } from '@/lib/validators/pacote-organizar';
import { organizarPacote } from '@/lib/db/pacote-organizar';
import { enqueueSendWhatsApp } from '@/lib/queue/enqueue-send-whatsapp';

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
    const pacoteId = parseIdParam((await params).id);
    if (!pacoteId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

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

    // Story 4.3 — enfileira notificação WhatsApp pra primeira organização.
    // Idempotência via jobId determinístico (sendWhatsApp:{pacote_id}) — re-organização
    // não dispara novo envio. Falha de enfileiramento não bloqueia resposta da API.
    if (!result.already_organized) {
      try {
        await enqueueSendWhatsApp({
          pacote_id: pacoteId,
          condominio_id: ctx.condominioId,
        });
      } catch (enqueueErr) {
        log.error({ pacote_id: pacoteId, err: enqueueErr }, 'Falha ao enfileirar sendWhatsApp');
      }
    }

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
