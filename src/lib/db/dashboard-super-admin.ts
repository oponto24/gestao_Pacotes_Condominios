/**
 * Helpers de dashboard `/super-admin` (Onda 1 — Apple polish).
 *
 * Sem RLS — caller já validou role super_admin no layout.
 */

import { db } from '@/lib/db';

export interface SuperAdminStats {
  condominiosAtivos: number;
  usersTotal: number;
  pacotes24h: number;
  pendentesGlobal: number;
}

export async function getSuperAdminStats(): Promise<SuperAdminStats> {
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [conds, users, pacotes24h, pendentes] = await Promise.all([
    db.condominio.count({ where: { ativo: true, deleted_at: null } }),
    db.user.count({ where: { ativo: true } }),
    db.pacote.count({ where: { created_at: { gte: ontem } } }),
    db.pacote.count({ where: { status: 'pendente_identificacao' } }),
  ]);

  return {
    condominiosAtivos: conds,
    usersTotal: users,
    pacotes24h,
    pendentesGlobal: pendentes,
  };
}

export interface RecentCondominio {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  created_at: Date;
}

export async function getRecentCondominios(limit = 5): Promise<RecentCondominio[]> {
  return db.condominio.findMany({
    where: { ativo: true, deleted_at: null },
    orderBy: { created_at: 'desc' },
    take: limit,
    select: { id: true, nome: true, cidade: true, estado: true, created_at: true },
  });
}

export interface RecentAuditEntry {
  id: string;
  acao: string;
  user_email: string | null;
  created_at: Date;
}

export async function getRecentAuditEntries(limit = 5): Promise<RecentAuditEntry[]> {
  const items = await db.auditLog.findMany({
    orderBy: { created_at: 'desc' },
    take: limit,
    select: { id: true, acao: true, created_at: true, user_id: true },
  });
  const userIds = [...new Set(items.map((i) => i.user_id).filter(Boolean) as string[])];
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true },
      })
    : [];
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  return items.map((i) => ({
    id: i.id.toString(),
    acao: i.acao,
    user_email: i.user_id ? emailById.get(i.user_id) ?? null : null,
    created_at: i.created_at,
  }));
}
