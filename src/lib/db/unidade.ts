/**
 * Helpers Prisma para Unidade — TENANT-SCOPED.
 *
 * CRÍTICO: Todas as funções via `withTenant()` (RLS automático).
 *
 * **Unique composite com NULL:** Postgres trata `(condId, '101', NULL)` como
 * distinto de outro `(condId, '101', NULL)`. Por isso `findUnidadeByIdentificador`
 * faz match explícito tratando bloco NULL via `bloco: null` (Prisma traduz para
 * `IS NULL` no SQL).
 */
import { withTenant } from '@/server/db-tenant';
import { assertUnidadeQuota } from '@/lib/db/quotas';
import type { UnidadeCreateInput, UnidadeUpdateInput } from '@/lib/validators/unidade';

export interface ListUnidadesParams {
  page: number;
  pageSize: number;
  q?: string;
  includeInativas: boolean;
}

const COUNT_SELECT = {
  _count: { select: { moradores: true, pacotes: true } },
  bloco_ref: { select: { id: true, nome: true } },
} as const;

export function listUnidades(params: ListUnidadesParams) {
  return withTenant(async (tx) => {
    const where = {
      ...(params.includeInativas ? {} : { ativo: true }),
      ...(params.q
        ? {
            OR: [
              { identificador: { contains: params.q, mode: 'insensitive' as const } },
              { bloco: { contains: params.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      tx.unidade.findMany({
        where,
        include: COUNT_SELECT,
        orderBy: [{ bloco: 'asc' }, { identificador: 'asc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      tx.unidade.count({ where }),
    ]);

    return { items, total, page: params.page, pageSize: params.pageSize };
  });
}

export function getUnidadeById(id: string, includeInativa = true) {
  return withTenant((tx) =>
    tx.unidade.findFirst({
      where: { id, ...(includeInativa ? {} : { ativo: true }) },
      include: COUNT_SELECT,
    }),
  );
}

/**
 * Detecta duplicata por `(identificador, bloco)` dentro do mesmo tenant.
 * Trata bloco NULL explicitamente — Postgres não considera NULL = NULL em UNIQUE,
 * então confiar no DB constraint sozinho deixaria duplicatas-NULL passarem.
 */
export function findUnidadeByIdentificador(
  identificador: string,
  bloco: string | null | undefined,
  excludeId?: string,
) {
  return withTenant((tx) =>
    tx.unidade.findFirst({
      where: {
        identificador,
        bloco: bloco ?? null, // Prisma traduz para IS NULL quando bloco === null
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    }),
  );
}

export function createUnidade(data: UnidadeCreateInput, condominioId: string) {
  return withTenant(async (tx) => {
    await assertUnidadeQuota(tx, condominioId);
    return tx.unidade.create({
      data: {
        condominio_id: condominioId,
        identificador: data.identificador,
        bloco: data.bloco ?? null,
        bloco_id: data.bloco_id ?? null,
        observacoes: data.observacoes ?? null,
        ativo: true,
      },
    });
  });
}

export function updateUnidade(id: string, data: UnidadeUpdateInput) {
  return withTenant((tx) =>
    tx.unidade.update({
      where: { id },
      data: {
        ...(data.identificador !== undefined && { identificador: data.identificador }),
        ...(data.bloco !== undefined && { bloco: data.bloco || null }),
        ...(data.bloco_id !== undefined && { bloco_id: data.bloco_id || null }),
        ...(data.observacoes !== undefined && { observacoes: data.observacoes || null }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
    }),
  );
}

export function setUnidadeAtiva(id: string, ativo: boolean) {
  return withTenant((tx) => tx.unidade.update({ where: { id }, data: { ativo } }));
}

/** DELETE físico. Caller DEVE validar `_count.moradores === 0 && _count.pacotes === 0` antes. */
export function deleteUnidade(id: string) {
  return withTenant((tx) => tx.unidade.delete({ where: { id } }));
}
