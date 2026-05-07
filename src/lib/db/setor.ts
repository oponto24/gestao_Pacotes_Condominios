/**
 * Helpers Prisma para Setor — TENANT-SCOPED.
 *
 * CRÍTICO: TODAS as funções usam `withTenant()` que aplica RLS automaticamente
 * via `SET LOCAL app.current_condominio` na transação. Isolamento garantido.
 *
 * NUNCA usar `db.setor` direto fora de `withTenant` — vaza dados cross-tenant.
 */
import { withTenant } from '@/server/db-tenant';
import type { SetorCreateInput, SetorUpdateInput } from '@/lib/validators/setor';

export interface ListSetoresParams {
  page: number;
  pageSize: number;
  q?: string;
  includeInativos: boolean;
}

const COUNT_SELECT = { _count: { select: { pacotes: true } } } as const;

export function listSetores(params: ListSetoresParams) {
  return withTenant(async (tx) => {
    const where = {
      ...(params.includeInativos ? {} : { ativo: true }),
      ...(params.q ? { nome: { contains: params.q, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      tx.setor.findMany({
        where,
        include: COUNT_SELECT,
        orderBy: { nome: 'asc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      tx.setor.count({ where }),
    ]);

    return { items, total, page: params.page, pageSize: params.pageSize };
  });
}

export function getSetorById(id: string, includeInativo = true) {
  return withTenant((tx) =>
    tx.setor.findFirst({
      where: { id, ...(includeInativo ? {} : { ativo: true }) },
      include: COUNT_SELECT,
    }),
  );
}

/** Detecta duplicata por nome dentro do MESMO tenant (RLS isola). */
export function findSetorByNome(nome: string, excludeId?: string) {
  return withTenant((tx) =>
    tx.setor.findFirst({
      where: { nome, ...(excludeId ? { id: { not: excludeId } } : {}) },
    }),
  );
}

/**
 * Cria setor. `condominio_id` é injetado a partir do tenant context — payload
 * NUNCA fornece (defesa contra escape via input).
 */
export function createSetor(data: SetorCreateInput, condominioId: string) {
  return withTenant((tx) =>
    tx.setor.create({
      data: {
        condominio_id: condominioId,
        nome: data.nome,
        descricao: data.descricao ?? null,
        capacidade: data.capacidade ?? null,
        ativo: true,
      },
    }),
  );
}

/**
 * Update parcial. NÃO permite mudar `condominio_id` (escape de tenant).
 */
export function updateSetor(id: string, data: SetorUpdateInput) {
  return withTenant((tx) =>
    tx.setor.update({
      where: { id },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.descricao !== undefined && { descricao: data.descricao || null }),
        ...(data.capacidade !== undefined && { capacidade: data.capacidade ?? null }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
    }),
  );
}

export function setSetorAtivo(id: string, ativo: boolean) {
  return withTenant((tx) =>
    tx.setor.update({ where: { id }, data: { ativo } }),
  );
}

/** DELETE físico. Caller DEVE validar `_count.pacotes === 0` antes. */
export function deleteSetor(id: string) {
  return withTenant((tx) => tx.setor.delete({ where: { id } }));
}
