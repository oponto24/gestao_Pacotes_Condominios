/**
 * Helpers Prisma para Morador — TENANT-SCOPED.
 *
 * CRÍTICO:
 * 1. Todas via `withTenant()` (RLS automático)
 * 2. `nome_normalizado` calculado server-side (lowercase + sem acento)
 * 3. Invariante "1 principal por unidade" aplicada em transação
 * 4. Soft delete via `deleted_at` (NFR-031 LGPD) — NUNCA DELETE físico
 */
import { withTenant } from '@/server/db-tenant';
import { normalizarNome } from '@/lib/text/normalize';
import type { MoradorCreateInput, MoradorUpdateInput } from '@/lib/validators/morador';

export interface ListMoradoresParams {
  page: number;
  pageSize: number;
  q?: string;
  unidadeId?: string;
  includeInativos: boolean;
  includeArquivados: boolean;
}

const COUNT_SELECT = {
  _count: { select: { pacotes_destinatario: true } },
} as const;

const DETAIL_INCLUDE = {
  _count: { select: { pacotes_destinatario: true } },
  unidade: { select: { id: true, identificador: true, bloco: true } },
} as const;

export function listMoradores(params: ListMoradoresParams) {
  return withTenant(async (tx) => {
    const where = {
      ...(params.includeArquivados ? {} : { deleted_at: null }),
      ...(params.includeInativos ? {} : { ativo: true }),
      ...(params.unidadeId ? { unidade_id: params.unidadeId } : {}),
      ...(params.q
        ? {
            OR: [
              { nome: { contains: params.q, mode: 'insensitive' as const } },
              { telefone: { contains: params.q } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      tx.morador.findMany({
        where,
        include: COUNT_SELECT,
        orderBy: [
          { unidade_id: 'asc' },
          { is_principal: 'desc' },
          { nome: 'asc' },
        ],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      tx.morador.count({ where }),
    ]);

    return { items, total, page: params.page, pageSize: params.pageSize };
  });
}

export function getMoradorById(id: string, includeArquivado = true) {
  return withTenant((tx) =>
    tx.morador.findFirst({
      where: { id, ...(includeArquivado ? {} : { deleted_at: null }) },
      include: DETAIL_INCLUDE,
    }),
  );
}

/** Confirma que a unidade existe no tenant (defesa contra unidade_id forjado). */
export function getUnidadeIdInTenant(unidadeId: string) {
  return withTenant((tx) => tx.unidade.findFirst({ where: { id: unidadeId }, select: { id: true } }));
}

export function findMoradorByTelefone(telefone: string, excludeId?: string) {
  return withTenant((tx) =>
    tx.morador.findFirst({
      where: { telefone, ...(excludeId ? { id: { not: excludeId } } : {}) },
    }),
  );
}

/**
 * Cria morador. Aplica invariante "1 principal por unidade" em transação
 * se `is_principal=true` (desativa principal anterior da mesma unidade).
 */
export function createMorador(data: MoradorCreateInput, condominioId: string) {
  return withTenant(async (tx) => {
    if (data.is_principal) {
      await tx.morador.updateMany({
        where: { unidade_id: data.unidade_id, is_principal: true, deleted_at: null },
        data: { is_principal: false },
      });
    }
    return tx.morador.create({
      data: {
        condominio_id: condominioId,
        unidade_id: data.unidade_id,
        nome: data.nome,
        nome_normalizado: normalizarNome(data.nome),
        telefone: data.telefone,
        email: data.email ?? null,
        is_principal: data.is_principal ?? false,
        ativo: true,
      },
    });
  });
}

/**
 * Update parcial. Recalcula `nome_normalizado` se nome mudou.
 * Aplica invariante 1-principal se `is_principal` virou true.
 *
 * NÃO permite mudar `unidade_id` ou `condominio_id` (Zod schema sem esses campos).
 */
export function updateMorador(id: string, data: MoradorUpdateInput) {
  return withTenant(async (tx) => {
    const existing = await tx.morador.findFirst({ where: { id }, select: { unidade_id: true, is_principal: true } });
    if (!existing) throw new Error('Morador não encontrado durante update');

    // Aplica invariante apenas se virou principal (false→true)
    const ficaraPrincipal = data.is_principal === true && !existing.is_principal;
    if (ficaraPrincipal) {
      await tx.morador.updateMany({
        where: {
          unidade_id: existing.unidade_id,
          is_principal: true,
          deleted_at: null,
          id: { not: id },
        },
        data: { is_principal: false },
      });
    }

    return tx.morador.update({
      where: { id },
      data: {
        ...(data.nome !== undefined && {
          nome: data.nome,
          nome_normalizado: normalizarNome(data.nome),
        }),
        ...(data.telefone !== undefined && { telefone: data.telefone }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.is_principal !== undefined && { is_principal: data.is_principal }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
    });
  });
}

/** Soft delete LGPD — NUNCA DELETE físico. Desmarca `is_principal`. */
export function archiveMorador(id: string) {
  return withTenant((tx) =>
    tx.morador.update({
      where: { id },
      data: { deleted_at: new Date(), ativo: false, is_principal: false },
    }),
  );
}

/** Restore — zera deleted_at + ativo=true. NÃO vira principal automaticamente. */
export function restoreMorador(id: string) {
  return withTenant((tx) =>
    tx.morador.update({
      where: { id },
      data: { deleted_at: null, ativo: true },
    }),
  );
}
