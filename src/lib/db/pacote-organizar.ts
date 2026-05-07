/**
 * DB helpers de organização de pacote (story 3.9).
 *
 * Após esta etapa, status vira `aguardando_retirada` — gatilho da Epic 4
 * (notificação WhatsApp).
 */

import { withTenantContext } from '@/server/db-tenant';
import type { PacoteOrganizarInput } from '@/lib/validators/pacote-organizar';
import { NotFoundError, ValidationError } from '@/server/errors';

export interface OrganizarCtx {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'admin' | 'porteiro';
}

export interface PacoteForOrganizar {
  id: string;
  status: string;
  nome_destinatario_etiqueta: string | null;
  unidade_id: string | null;
  unidade_label: string | null;
  destinatario_nome: string | null;
  tamanho: string | null;
  setor_id: string | null;
  posicao: string | null;
  setores: Array<{ id: string; nome: string; descricao: string | null }>;
  ja_organizado: boolean;
}

export async function loadPacoteForOrganizar(
  ctx: OrganizarCtx,
  pacoteId: string,
): Promise<PacoteForOrganizar | null> {
  return withTenantContext(ctx, async (tx) => {
    const pacote = await tx.pacote.findFirst({
      where: { id: pacoteId },
      select: {
        id: true,
        status: true,
        nome_destinatario_etiqueta: true,
        unidade_id: true,
        destinatario_id: true,
        tamanho: true,
        setor_id: true,
        posicao: true,
        unidade: { select: { identificador: true, bloco: true } },
        destinatario: { select: { nome: true } },
      },
    });
    if (!pacote) return null;
    if (pacote.status === 'cancelado' || pacote.status === 'retirado') return null;

    const setores = await tx.setor.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, descricao: true },
      orderBy: { nome: 'asc' },
    });

    const unidadeLabel = pacote.unidade
      ? `${pacote.unidade.bloco ? `Bloco ${pacote.unidade.bloco} · ` : ''}${pacote.unidade.identificador}`
      : null;

    return {
      id: pacote.id,
      status: pacote.status,
      nome_destinatario_etiqueta: pacote.nome_destinatario_etiqueta,
      unidade_id: pacote.unidade_id,
      unidade_label: unidadeLabel,
      destinatario_nome: pacote.destinatario?.nome ?? null,
      tamanho: pacote.tamanho,
      setor_id: pacote.setor_id,
      posicao: pacote.posicao,
      setores,
      ja_organizado: pacote.status === 'aguardando_retirada',
    };
  });
}

export interface OrganizarPacoteResult {
  pacote_id: string;
  status: string;
  already_organized: boolean;
}

export async function organizarPacote(
  ctx: OrganizarCtx,
  pacoteId: string,
  input: PacoteOrganizarInput,
): Promise<OrganizarPacoteResult> {
  return withTenantContext(ctx, async (tx) => {
    const pacote = await tx.pacote.findFirst({
      where: { id: pacoteId },
      select: {
        id: true,
        status: true,
        unidade_id: true,
        tamanho: true,
        setor_id: true,
        posicao: true,
      },
    });
    if (!pacote) throw new NotFoundError('Pacote não encontrado');
    if (pacote.status === 'cancelado' || pacote.status === 'retirado') {
      throw new ValidationError(`Pacote em estado terminal: ${pacote.status}`);
    }
    if (!pacote.unidade_id) {
      throw new ValidationError(
        'Pacote precisa estar confirmado (3.8) antes de organizar',
      );
    }

    // Idempotência
    if (
      pacote.status === 'aguardando_retirada' &&
      pacote.tamanho === input.tamanho &&
      pacote.setor_id === input.setor_id &&
      pacote.posicao === input.posicao
    ) {
      return {
        pacote_id: pacoteId,
        status: 'aguardando_retirada',
        already_organized: true,
      };
    }

    // Valida setor pertence ao tenant + ativo
    const setor = await tx.setor.findFirst({
      where: { id: input.setor_id, ativo: true },
      select: { id: true },
    });
    if (!setor) throw new ValidationError('Setor inválido ou inativo');

    await tx.pacote.update({
      where: { id: pacoteId },
      data: {
        tamanho: input.tamanho,
        setor_id: input.setor_id,
        posicao: input.posicao,
        status: 'aguardando_retirada',
      },
    });

    return {
      pacote_id: pacoteId,
      status: 'aguardando_retirada',
      already_organized: false,
    };
  });
}
