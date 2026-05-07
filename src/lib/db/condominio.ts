/**
 * Helpers Prisma para Condominio — operações super_admin (cross-tenant).
 *
 * IMPORTANTE: Condominio NÃO tem RLS (story 1.4 não criou policy). Usa `db`
 * direto, sem `withTenant`. Caller DEVE garantir guard de super_admin antes
 * de invocar (helpers não fazem auth).
 */
import { db } from '@/lib/db';
import type { CondominioCreateInput, CondominioUpdateInput } from '@/lib/validators/condominio';

export interface ListCondominiosParams {
  page: number;
  pageSize: number;
  q?: string;
  includeArquivados: boolean;
}

const LIST_INCLUDE = {
  _count: { select: { unidades: true, moradores: true } },
} as const;

const DETAIL_INCLUDE = {
  _count: { select: { unidades: true, setores: true, moradores: true, pacotes: true } },
} as const;

export async function listCondominios(params: ListCondominiosParams) {
  const where = {
    ...(params.includeArquivados ? {} : { deleted_at: null }),
    ...(params.q ? { nome: { contains: params.q, mode: 'insensitive' as const } } : {}),
  };

  const [items, total] = await Promise.all([
    db.condominio.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: { nome: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.condominio.count({ where }),
  ]);

  return { items, total, page: params.page, pageSize: params.pageSize };
}

export function getCondominioById(id: string, includeArquivados = false) {
  return db.condominio.findFirst({
    where: { id, ...(includeArquivados ? {} : { deleted_at: null }) },
    include: DETAIL_INCLUDE,
  });
}

/** Garante que CNPJ não esteja em uso (ativo OU arquivado — unique global). */
export async function findCondominioByCnpj(cnpj: string, excludeId?: string) {
  return db.condominio.findFirst({
    where: { cnpj, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
}

export function createCondominio(data: CondominioCreateInput) {
  return db.condominio.create({
    data: {
      nome: data.nome,
      cnpj: data.cnpj ?? null,
      endereco: data.endereco,
      cep: data.cep,
      cidade: data.cidade,
      estado: data.estado,
      contato_nome: data.contato_nome,
      contato_telefone: data.contato_telefone,
      contato_email: data.contato_email ?? null,
      ativo: true,
    },
  });
}

export function updateCondominio(id: string, data: CondominioUpdateInput) {
  return db.condominio.update({
    where: { id },
    data: {
      ...(data.nome !== undefined && { nome: data.nome }),
      ...(data.cnpj !== undefined && { cnpj: data.cnpj || null }),
      ...(data.endereco !== undefined && { endereco: data.endereco }),
      ...(data.cep !== undefined && { cep: data.cep }),
      ...(data.cidade !== undefined && { cidade: data.cidade }),
      ...(data.estado !== undefined && { estado: data.estado }),
      ...(data.contato_nome !== undefined && { contato_nome: data.contato_nome }),
      ...(data.contato_telefone !== undefined && { contato_telefone: data.contato_telefone }),
      ...(data.contato_email !== undefined && { contato_email: data.contato_email || null }),
    },
  });
}

export function archiveCondominio(id: string) {
  return db.condominio.update({
    where: { id },
    data: { deleted_at: new Date(), ativo: false },
  });
}

export function restoreCondominio(id: string) {
  return db.condominio.update({
    where: { id },
    data: { deleted_at: null, ativo: true },
  });
}
