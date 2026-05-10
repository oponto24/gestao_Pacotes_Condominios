/**
 * Helpers de dashboard `/super-admin` (Onda 1 — Apple polish).
 *
 * Bypass RLS via `withSuperAdmin` — caller já validou role super_admin
 * no layout, mas precisamos do bypass pra ler tabelas multi-tenant.
 */

import { withSuperAdmin } from '@/lib/db-super-admin';

export interface SuperAdminStats {
  condominiosAtivos: number;
  usersTotal: number;
  pacotes24h: number;
  pendentesGlobal: number;
  // Story 12.1 (Epic 12 — PRD FR-120): breakdown por role
  adminsAtivos: number; // admin_master + admin_funcionario
  porteirosAtivos: number;
  adminMastersAtivos: number;
  adminFuncionariosAtivos: number;
}

export async function getSuperAdminStats(): Promise<SuperAdminStats> {
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    conds,
    users,
    pacotes24h,
    pendentes,
    adminMasters,
    adminFuncs,
    porteiros,
  ] = await withSuperAdmin((tx) =>
    Promise.all([
      tx.condominio.count({ where: { ativo: true, deleted_at: null } }),
      tx.user.count({ where: { ativo: true } }),
      tx.pacote.count({ where: { created_at: { gte: ontem } } }),
      tx.pacote.count({ where: { status: 'pendente_identificacao' } }),
      tx.user.count({ where: { ativo: true, role: 'admin_master' } }),
      tx.user.count({ where: { ativo: true, role: 'admin_funcionario' } }),
      tx.user.count({ where: { ativo: true, role: 'porteiro' } }),
    ]),
  );

  return {
    condominiosAtivos: conds,
    usersTotal: users,
    pacotes24h,
    pendentesGlobal: pendentes,
    adminsAtivos: adminMasters + adminFuncs,
    porteirosAtivos: porteiros,
    adminMastersAtivos: adminMasters,
    adminFuncionariosAtivos: adminFuncs,
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
  return withSuperAdmin((tx) =>
    tx.condominio.findMany({
      where: { ativo: true, deleted_at: null },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: { id: true, nome: true, cidade: true, estado: true, created_at: true },
    }),
  );
}

export interface RecentAuditEntry {
  id: string;
  acao: string;
  user_email: string | null;
  created_at: Date;
}

export async function getRecentAuditEntries(limit = 5): Promise<RecentAuditEntry[]> {
  const { items, users } = await withSuperAdmin(async (tx) => {
    const items = await tx.auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
      select: { id: true, acao: true, created_at: true, user_id: true },
    });
    const userIds = [...new Set(items.map((i) => i.user_id).filter(Boolean) as string[])];
    const users = userIds.length
      ? await tx.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];
    return { items, users };
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  return items.map((i) => ({
    id: i.id.toString(),
    acao: i.acao,
    user_email: i.user_id ? emailById.get(i.user_id) ?? null : null,
    created_at: i.created_at,
  }));
}
