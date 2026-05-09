/**
 * DB helpers de retirada (Epic 5).
 */

import { withTenantContext } from '@/server/db-tenant';
import type { RetirarConfirmarInput } from '@/lib/validators/retirar';
import { NotFoundError, ValidationError } from '@/server/errors';

export interface RetiradaCtx {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'admin_master' | 'admin_funcionario' | 'porteiro';
}

export interface PacoteRetirada {
  id: string;
  qr_token: string;
  status: string;
  qr_consumido_em: Date | null;
  nome_destinatario_etiqueta: string | null;
  complemento_etiqueta: string | null;
  remetente: string | null;
  posicao: string | null;
  unidade: { id: string; identificador: string; bloco: string | null } | null;
  destinatario: { id: string; nome: string } | null;
  setor: { id: string; nome: string } | null;
  foto_storage_path: string | null;
}

export type LoadResult =
  | { ok: true; pacote: PacoteRetirada }
  | { ok: false; reason: 'not_found' | 'already_retirado' | 'cancelado' | 'nao_pronto' };

export async function loadPacoteByQrToken(
  ctx: RetiradaCtx,
  qrToken: string,
): Promise<LoadResult> {
  return withTenantContext(ctx, async (tx) => {
    const pacote = await tx.pacote.findFirst({
      where: { qr_token: qrToken },
      select: {
        id: true,
        qr_token: true,
        status: true,
        qr_consumido_em: true,
        nome_destinatario_etiqueta: true,
        complemento_etiqueta: true,
        remetente: true,
        posicao: true,
        unidade: { select: { id: true, identificador: true, bloco: true } },
        destinatario: { select: { id: true, nome: true } },
        setor: { select: { id: true, nome: true } },
      },
    });
    if (!pacote) return { ok: false, reason: 'not_found' };

    if (pacote.status === 'retirado' || pacote.qr_consumido_em) {
      return { ok: false, reason: 'already_retirado' };
    }
    if (pacote.status === 'cancelado') {
      return { ok: false, reason: 'cancelado' };
    }
    if (pacote.status !== 'aguardando_retirada') {
      return { ok: false, reason: 'nao_pronto' };
    }

    const foto = await tx.pacoteFoto.findFirst({
      where: { pacote_id: pacote.id, is_principal: true },
      select: { storage_path: true },
    });

    return {
      ok: true,
      pacote: {
        id: pacote.id,
        qr_token: pacote.qr_token,
        status: pacote.status,
        qr_consumido_em: pacote.qr_consumido_em,
        nome_destinatario_etiqueta: pacote.nome_destinatario_etiqueta,
        complemento_etiqueta: pacote.complemento_etiqueta,
        remetente: pacote.remetente,
        posicao: pacote.posicao,
        unidade: pacote.unidade,
        destinatario: pacote.destinatario,
        setor: pacote.setor,
        foto_storage_path: foto?.storage_path ?? null,
      },
    };
  });
}

export interface ConfirmarRetiradaResult {
  pacote_id: string;
  status: string;
  already_retirado: boolean;
}

export async function confirmarRetirada(
  ctx: RetiradaCtx,
  pacoteId: string,
  input: RetirarConfirmarInput,
): Promise<ConfirmarRetiradaResult> {
  return withTenantContext(ctx, async (tx) => {
    const pacote = await tx.pacote.findFirst({
      where: { id: pacoteId },
      select: {
        id: true,
        status: true,
        qr_consumido_em: true,
        destinatario_id: true,
      },
    });
    if (!pacote) throw new NotFoundError('Pacote não encontrado');

    if (pacote.status === 'retirado' || pacote.qr_consumido_em) {
      return {
        pacote_id: pacoteId,
        status: 'retirado',
        already_retirado: true,
      };
    }

    if (pacote.status !== 'aguardando_retirada') {
      throw new ValidationError(
        `Pacote não está aguardando retirada (status: ${pacote.status})`,
      );
    }

    const now = new Date();
    const retiradoMoradorId = input.proprio_destinatario
      ? pacote.destinatario_id
      : null;
    const retiradoTerceiro = input.proprio_destinatario
      ? null
      : input.retirado_por_terceiro;

    await tx.pacote.update({
      where: { id: pacoteId },
      data: {
        status: 'retirado',
        qr_consumido_em: now,
        retirado_em: now,
        funcionario_entregador_id: ctx.userId,
        retirado_por_morador_id: retiradoMoradorId,
        retirado_por_terceiro: retiradoTerceiro,
      },
    });

    await tx.pacoteEvento.create({
      data: {
        condominio_id: ctx.condominioId,
        pacote_id: pacoteId,
        tipo: 'retirado',
        user_id: ctx.userId,
        metadata: {
          proprio_destinatario: input.proprio_destinatario,
          retirado_por_morador_id: retiradoMoradorId,
          retirado_por_terceiro: retiradoTerceiro,
        },
      },
    });

    return {
      pacote_id: pacoteId,
      status: 'retirado',
      already_retirado: false,
    };
  });
}
