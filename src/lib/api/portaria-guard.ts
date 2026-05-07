import { getTenantContext } from '@/server/middleware/tenant';
import { ForbiddenError } from '@/server/errors';

interface PortariaTenantContext {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'porteiro' | 'admin';
}

/**
 * Guard de rota portaria — aceita roles `porteiro` e `admin`.
 *
 * Lança 403 se super_admin (que tem sua área /super-admin/*) ou outros roles.
 * `getTenantContext()` lança Unauthorized (401) se não autenticado e
 * NoCondominioAssigned (403) se sem condomínio.
 *
 * Decisão @po: admin pode operar a portaria se necessário (substituir
 * porteiro afastado). Super-admin NÃO opera — supervisiona.
 */
export async function requirePorteiro(): Promise<PortariaTenantContext> {
  const ctx = await getTenantContext();
  if (ctx.kind !== 'tenant' || (ctx.role !== 'porteiro' && ctx.role !== 'admin')) {
    throw new ForbiddenError('Acesso negado');
  }
  return {
    kind: 'tenant',
    userId: ctx.userId,
    condominioId: ctx.condominioId,
    role: ctx.role,
  };
}
