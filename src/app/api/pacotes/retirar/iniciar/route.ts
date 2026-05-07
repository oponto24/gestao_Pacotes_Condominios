import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError } from '@/server/errors';
import { retirarIniciarSchema } from '@/lib/validators/retirar';
import { loadPacoteByQrToken } from '@/lib/db/pacote-retirada';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/pacotes/retirar/iniciar (story 5.2)
 *
 * Recebe `qr_token` no body, valida estado do pacote, retorna dados pra UI da 5.3.
 * NÃO altera estado.
 */
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'pacotes:retirar:iniciar' });
  try {
    const ctx = await requirePorteiro();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Body inválido (JSON esperado)');
    }
    const parsed = retirarIniciarSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }

    const result = await loadPacoteByQrToken(ctx, parsed.data.qr_token);
    if (!result.ok) {
      const statusByReason: Record<string, number> = {
        not_found: 404,
        already_retirado: 409,
        cancelado: 409,
        nao_pronto: 409,
      };
      const messages: Record<string, string> = {
        not_found: 'Pacote não encontrado',
        already_retirado: 'Pacote já foi retirado',
        cancelado: 'Pacote cancelado',
        nao_pronto: 'Pacote ainda não está pronto para retirada',
      };
      return NextResponse.json(
        { ok: false, reason: result.reason, message: messages[result.reason] },
        { status: statusByReason[result.reason] ?? 400 },
      );
    }

    log.info({ pacote_id: result.pacote.id }, 'Retirada iniciada');
    return NextResponse.json({ ok: true, pacote: result.pacote }, { status: 200 });
  } catch (err) {
    return handleApiError(err, log);
  }
}
