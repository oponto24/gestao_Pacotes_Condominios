/**
 * Cancelamento de pacote (decisão produto 2026-05-09).
 *
 * Apenas `admin_master` pode cancelar — porteiro e admin_funcionario não têm essa
 * autoridade. Cancelamento é forward-only: status terminal `cancelado`, sem
 * reversão automática (para reabrir, criar novo pacote).
 */

import { withTenantContext } from '@/server/db-tenant';
import { NotFoundError, ValidationError } from '@/server/errors';

export interface CancelarCtx {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'admin_master';
}

export async function cancelarPacote(
  ctx: CancelarCtx,
  pacoteId: string,
  motivo: string,
): Promise<{ pacote_id: string; status: 'cancelado'; already_canceled: boolean }> {
  const motivoTrim = motivo.trim();
  if (!motivoTrim) throw new ValidationError('Motivo do cancelamento é obrigatório');
  if (motivoTrim.length > 500) {
    throw new ValidationError('Motivo muito longo (máx 500 caracteres)');
  }

  return withTenantContext(ctx, async (tx) => {
    const pacote = await tx.pacote.findFirst({
      where: { id: pacoteId },
      select: { id: true, status: true },
    });
    if (!pacote) throw new NotFoundError('Pacote não encontrado');

    if (pacote.status === 'cancelado') {
      return { pacote_id: pacoteId, status: 'cancelado', already_canceled: true };
    }

    if (pacote.status === 'retirado') {
      throw new ValidationError('Pacote já retirado não pode ser cancelado');
    }

    await tx.pacote.update({
      where: { id: pacoteId },
      data: { status: 'cancelado' },
    });

    await tx.pacoteEvento.create({
      data: {
        condominio_id: ctx.condominioId,
        pacote_id: pacoteId,
        tipo: 'cancelado',
        user_id: ctx.userId,
        metadata: {
          motivo: motivoTrim,
          status_anterior: pacote.status,
        },
      },
    });

    return { pacote_id: pacoteId, status: 'cancelado', already_canceled: false };
  });
}
