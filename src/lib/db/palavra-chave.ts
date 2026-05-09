/**
 * DB helpers de palavra-chave (Epic 7).
 *
 * Reusa tabela `codigo_ml_pendente` (legacy naming — refactor enum/table
 * deferido pra evitar migration cross-breaking).
 */

import { withTenantContext } from '@/server/db-tenant';

export interface PalavraChaveCtx {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'admin_master' | 'admin_funcionario' | 'porteiro';
}

export interface PalavraChavePendente {
  id: string;
  codigo: string;
  descricao: string | null;
  created_at: Date;
  expira_em: Date;
  morador_id: string;
  morador_nome: string;
  unidade_id: string;
  unidade_label: string;
}

export interface ListPalavrasChaveOptions {
  q?: string;
  unidade_id?: string;
}

export async function listPalavrasChavePendentes(
  ctx: PalavraChaveCtx,
  opts: ListPalavrasChaveOptions = {},
): Promise<PalavraChavePendente[]> {
  return withTenantContext(ctx, async (tx) => {
    const where = {
      status: 'pendente' as const,
      expira_em: { gt: new Date() },
      ...(opts.unidade_id ? { morador: { unidade_id: opts.unidade_id } } : {}),
      ...(opts.q
        ? {
            OR: [
              { codigo: { contains: opts.q, mode: 'insensitive' as const } },
              { descricao: { contains: opts.q, mode: 'insensitive' as const } },
              { morador: { nome: { contains: opts.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const codigos = await tx.codigoMlPendente.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        codigo: true,
        descricao: true,
        created_at: true,
        expira_em: true,
        morador: {
          select: {
            id: true,
            nome: true,
            unidade: {
              select: {
                id: true,
                identificador: true,
                bloco: true,
              },
            },
          },
        },
      },
    });

    return codigos.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      descricao: c.descricao,
      created_at: c.created_at,
      expira_em: c.expira_em,
      morador_id: c.morador.id,
      morador_nome: c.morador.nome,
      unidade_id: c.morador.unidade.id,
      unidade_label: `${c.morador.unidade.bloco ? `Bloco ${c.morador.unidade.bloco} · ` : ''}${c.morador.unidade.identificador}`,
    }));
  });
}
