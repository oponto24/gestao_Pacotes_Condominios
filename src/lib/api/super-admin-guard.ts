import { getTenantContext } from '@/server/middleware/tenant';
import { ForbiddenError } from '@/server/errors';

/**
 * Guard de endpoint super_admin only. Lança 403 se outro role.
 * Reutiliza tenant context (que já trata 401/pending/no_condominio).
 */
export async function requireSuperAdmin() {
  const ctx = await getTenantContext();
  if (ctx.kind !== 'super_admin') {
    throw new ForbiddenError('Apenas super_admin pode acessar este endpoint');
  }
  return ctx;
}
