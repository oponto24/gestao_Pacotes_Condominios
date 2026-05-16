/**
 * Helpers Prisma para Bloco — TENANT-SCOPED.
 *
 * CRITICO: TODAS as funcoes usam `withTenant()` que aplica RLS automaticamente
 * via `SET LOCAL app.current_condominio` na transacao. Isolamento garantido.
 *
 * NUNCA usar `db.bloco` direto fora de `withTenant` — vaza dados cross-tenant.
 */
import { withTenant } from '@/server/db-tenant';
import type { BlocoCreateInput, BlocoUpdateInput } from '@/lib/validators/bloco';

export interface ListBlocosParams {
  page: number;
  pageSize: number;
  q?: string;
  includeInativos: boolean;
}

const COUNT_SELECT = { _count: { select: { unidades: true } } } as const;

export function listBlocos(params: ListBlocosParams) {
  return withTenant(async (tx) => {
    const where = {
      ...(params.includeInativos ? {} : { ativo: true }),
      ...(params.q ? { nome: { contains: params.q, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      tx.bloco.findMany({
        where,
        include: COUNT_SELECT,
        orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      tx.bloco.count({ where }),
    ]);

    return { items, total, page: params.page, pageSize: params.pageSize };
  });
}

export function getBlocoById(id: string) {
  return withTenant((tx) =>
    tx.bloco.findFirst({
      where: { id },
      include: {
        ...COUNT_SELECT,
        unidades: {
          include: { _count: { select: { moradores: true } } },
          orderBy: { identificador: 'asc' },
        },
      },
    }),
  );
}

/** Detecta duplicata por nome dentro do MESMO tenant (RLS isola). */
export function findBlocoByNome(nome: string, excludeId?: string) {
  return withTenant((tx) =>
    tx.bloco.findFirst({
      where: { nome, ...(excludeId ? { id: { not: excludeId } } : {}) },
    }),
  );
}

/**
 * Cria bloco. `condominio_id` e injetado a partir do tenant context — payload
 * NUNCA fornece (defesa contra escape via input).
 */
export function createBloco(data: BlocoCreateInput, condominioId: string) {
  return withTenant((tx) =>
    tx.bloco.create({
      data: {
        condominio_id: condominioId,
        nome: data.nome,
        descricao: data.descricao ?? null,
        ordem: data.ordem ?? 0,
        ativo: true,
      },
    }),
  );
}

/**
 * Update parcial. NAO permite mudar `condominio_id` (escape de tenant).
 */
export function updateBloco(id: string, data: BlocoUpdateInput) {
  return withTenant((tx) =>
    tx.bloco.update({
      where: { id },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.descricao !== undefined && { descricao: data.descricao || null }),
        ...(data.ordem !== undefined && { ordem: data.ordem ?? 0 }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
    }),
  );
}

/** Soft delete — seta ativo=false. */
export function softDeleteBloco(id: string) {
  return withTenant((tx) =>
    tx.bloco.update({ where: { id }, data: { ativo: false } }),
  );
}
