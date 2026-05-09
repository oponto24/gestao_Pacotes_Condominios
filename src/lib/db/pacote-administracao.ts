/**
 * DB helpers da rota administração (story 10.6 — Epic 10).
 *
 * Pacote `aguardando_retirada` pode ir pra `em_administracao` quando
 * porteiro/admin decide entregar via admin (ex: pacote grande, morador viajou).
 */

import { withTenantContext } from '@/server/db-tenant';
import { NotFoundError, ValidationError } from '@/server/errors';

export interface AdministracaoCtx {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'admin_master' | 'admin_funcionario' | 'porteiro';
}

export interface PacoteEmAdministracao {
  id: string;
  recebido_em: Date | null;
  enviado_para_admin_em: Date | null;
  nome_destinatario_etiqueta: string | null;
  unidade_label: string | null;
  destinatario_nome: string | null;
  destinatario_telefone: string | null;
  setor_nome: string | null;
  posicao: string | null;
}

/**
 * Lista pacotes em `em_administracao` do tenant — fila de entrega da admin.
 */
export async function listPacotesEmAdministracao(
  ctx: AdministracaoCtx,
): Promise<PacoteEmAdministracao[]> {
  return withTenantContext(ctx, async (tx) => {
    const pacotes = await tx.pacote.findMany({
      where: { status: 'em_administracao' },
      orderBy: { updated_at: 'asc' },
      select: {
        id: true,
        recebido_em: true,
        updated_at: true,
        nome_destinatario_etiqueta: true,
        posicao: true,
        unidade: { select: { identificador: true, bloco: true } },
        destinatario: { select: { nome: true, telefone: true } },
        setor: { select: { nome: true } },
      },
    });

    return pacotes.map((p) => ({
      id: p.id,
      recebido_em: p.recebido_em,
      enviado_para_admin_em: p.updated_at, // approximation — Story 10.x adiciona campo dedicado se virar dor
      nome_destinatario_etiqueta: p.nome_destinatario_etiqueta,
      unidade_label: p.unidade
        ? `${p.unidade.bloco ? `Bloco ${p.unidade.bloco} · ` : ''}${p.unidade.identificador}`
        : null,
      destinatario_nome: p.destinatario?.nome ?? null,
      destinatario_telefone: p.destinatario?.telefone ?? null,
      setor_nome: p.setor?.nome ?? null,
      posicao: p.posicao,
    }));
  });
}

/**
 * Transição: aguardando_retirada → em_administracao. Idempotente: se já está
 * em_administracao, retorna sem mudança.
 */
export async function enviarParaAdministracao(
  ctx: AdministracaoCtx,
  pacoteId: string,
): Promise<{ pacote_id: string; status: string; already_in_admin: boolean }> {
  return withTenantContext(ctx, async (tx) => {
    const pacote = await tx.pacote.findFirst({
      where: { id: pacoteId },
      select: { id: true, status: true },
    });
    if (!pacote) throw new NotFoundError('Pacote não encontrado');

    if (pacote.status === 'em_administracao') {
      return { pacote_id: pacoteId, status: 'em_administracao', already_in_admin: true };
    }

    if (pacote.status !== 'aguardando_retirada') {
      throw new ValidationError(
        `Pacote em status "${pacote.status}" não pode ir pra administração — exige aguardando_retirada`,
      );
    }

    await tx.pacote.update({
      where: { id: pacoteId },
      data: { status: 'em_administracao' },
    });

    await tx.pacoteEvento.create({
      data: {
        condominio_id: ctx.condominioId,
        pacote_id: pacoteId,
        tipo: 'notificado', // reusa enum existente — evento custom seria refactor enum (deferido)
        user_id: ctx.userId,
        metadata: {
          acao: 'enviado_para_administracao',
          status_anterior: 'aguardando_retirada',
          status_novo: 'em_administracao',
        },
      },
    });

    return { pacote_id: pacoteId, status: 'em_administracao', already_in_admin: false };
  });
}
