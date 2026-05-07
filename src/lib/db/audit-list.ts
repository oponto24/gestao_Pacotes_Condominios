/**
 * Listagem de audit logs para super-admin (story 8.3).
 *
 * Tabela `audit_log` é global (sem RLS). Acesso restrito ao super-admin
 * via guard no layout/route.
 */

import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export interface AuditLogFilters {
  acao?: string | undefined;
  condominio_id?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface AuditLogItem {
  id: string;
  acao: string;
  user_id: string | null;
  user_nome: string | null;
  condominio_id: string | null;
  condominio_nome: string | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
  ip_address: string | null;
  metadata: unknown;
  created_at: Date;
}

export interface ListAuditLogsResult {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
}

export async function listAuditLogs(filters: AuditLogFilters): Promise<ListAuditLogsResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters.limit ?? 100));
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {};
  if (filters.acao && filters.acao.trim().length > 0) {
    where.acao = { contains: filters.acao.trim(), mode: 'insensitive' };
  }
  if (filters.condominio_id) where.condominio_id = filters.condominio_id;
  if (filters.from || filters.to) {
    where.created_at = {};
    if (filters.from) where.created_at.gte = filters.from;
    if (filters.to) where.created_at.lte = filters.to;
  }

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  // Resolve user.nome e condominio.nome em maps separados (audit log pode apontar
  // para entidades já deletadas — não fazemos JOIN obrigatório)
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])];
  const condIds = [
    ...new Set(rows.map((r) => r.condominio_id).filter(Boolean) as string[]),
  ];

  const [users, conds] = await Promise.all([
    userIds.length
      ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nome: true } })
      : [],
    condIds.length
      ? db.condominio.findMany({
          where: { id: { in: condIds } },
          select: { id: true, nome: true },
        })
      : [],
  ]);
  const userMap = new Map(users.map((u) => [u.id, u.nome]));
  const condMap = new Map(conds.map((c) => [c.id, c.nome]));

  return {
    items: rows.map((r) => ({
      id: r.id.toString(),
      acao: r.acao,
      user_id: r.user_id,
      user_nome: r.user_id ? userMap.get(r.user_id) ?? null : null,
      condominio_id: r.condominio_id,
      condominio_nome: r.condominio_id ? condMap.get(r.condominio_id) ?? null : null,
      entidade_tipo: r.entidade_tipo,
      entidade_id: r.entidade_id,
      ip_address: r.ip_address,
      metadata: r.metadata,
      created_at: r.created_at,
    })),
    total,
    page,
    limit,
  };
}
