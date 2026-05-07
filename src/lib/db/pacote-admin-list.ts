/**
 * Lista admin de pacotes (story 6.1 + 6.2).
 *
 * Tenant-scoped via withTenantContext. Suporta filtros + busca textual.
 */

import { Prisma } from '@prisma/client';
import { withTenantContext } from '@/server/db-tenant';

export interface AdminCtx {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'admin' | 'porteiro';
}

export type PacoteStatusFilter =
  | 'rascunho'
  | 'pendente_identificacao'
  | 'aguardando_retirada'
  | 'retirado'
  | 'cancelado';

export interface ListPacotesFilters {
  status?: PacoteStatusFilter | undefined;
  unidade_id?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  q?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface PacoteListItem {
  id: string;
  status: string;
  nome_destinatario_etiqueta: string | null;
  codigo_rastreio: string | null;
  recebido_em: Date | null;
  retirado_em: Date | null;
  unidade: { id: string; identificador: string; bloco: string | null } | null;
  destinatario: { id: string; nome: string } | null;
  setor: { id: string; nome: string } | null;
  ia_confianca: number | null;
}

export interface ListPacotesResult {
  items: PacoteListItem[];
  total: number;
  page: number;
  limit: number;
}

export async function listPacotesAdmin(
  ctx: AdminCtx,
  filters: ListPacotesFilters,
): Promise<ListPacotesResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  return withTenantContext(ctx, async (tx) => {
    const where: Prisma.PacoteWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.unidade_id) where.unidade_id = filters.unidade_id;
    if (filters.from || filters.to) {
      where.recebido_em = {};
      if (filters.from) where.recebido_em.gte = filters.from;
      if (filters.to) where.recebido_em.lte = filters.to;
    }

    // Busca textual (story 6.2): mínimo 2 chars, OR em campos do pacote/unidade
    if (filters.q && filters.q.trim().length >= 2) {
      const q = filters.q.trim();
      where.OR = [
        { nome_destinatario_etiqueta: { contains: q, mode: 'insensitive' } },
        { codigo_rastreio: { contains: q, mode: 'insensitive' } },
        { unidade: { identificador: { contains: q, mode: 'insensitive' } } },
        { unidade: { bloco: { contains: q, mode: 'insensitive' } } },
        { destinatario: { nome: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await Promise.all([
      tx.pacote.count({ where }),
      tx.pacote.findMany({
        where,
        select: {
          id: true,
          status: true,
          nome_destinatario_etiqueta: true,
          codigo_rastreio: true,
          recebido_em: true,
          retirado_em: true,
          ia_confianca: true,
          unidade: { select: { id: true, identificador: true, bloco: true } },
          destinatario: { select: { id: true, nome: true } },
          setor: { select: { id: true, nome: true } },
        },
        orderBy: { recebido_em: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((r) => ({
        ...r,
        ia_confianca: r.ia_confianca ? Number(r.ia_confianca) : null,
      })),
      total,
      page,
      limit,
    };
  });
}
