import { getTenantContext } from '@/server/middleware/tenant';
import { ForbiddenError } from '@/server/errors';

interface AdminTenantContext {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'admin';
}

/**
 * Guard de endpoint admin only (tenant-scoped).
 *
 * Lança 403 se: super_admin, porteiro, sem auth.
 * Apenas role 'admin' (com condominio_id setado) passa.
 *
 * Story 8.2 (impersonate) pode adicionar suporte para super_admin
 * impersonando admin — por enquanto, super_admin tem sua própria área
 * em /super-admin/*.
 */
export async function requireAdmin(): Promise<AdminTenantContext> {
  const ctx = await getTenantContext();
  if (ctx.kind !== 'tenant' || ctx.role !== 'admin') {
    throw new ForbiddenError('Acesso negado');
  }
  return { kind: 'tenant', userId: ctx.userId, condominioId: ctx.condominioId, role: 'admin' };
}
