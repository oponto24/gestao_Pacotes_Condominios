import { getTenantContext } from '@/server/middleware/tenant';
import { ForbiddenError } from '@/server/errors';

interface PortariaTenantContext {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'porteiro' | 'admin_master' | 'admin_funcionario';
}

/**
 * Guard de rota portaria — aceita `porteiro`, `admin_master` e `admin_funcionario`.
 *
 * Lança 403 se super_admin (área /super-admin) ou outros roles.
 * `getTenantContext()` lança Unauthorized (401) se não autenticado e
 * NoCondominioAssigned (403) se sem condomínio.
 *
 * Decisão @po: qualquer role operacional pode operar a portaria (story 10.1, FR-083).
 * - admin_master substituindo porteiro afastado
 * - admin_funcionario bipando entrega final (Epic 10 rota administração)
 * - porteiro fluxo normal
 *
 * Super-admin NÃO opera — supervisiona.
 */
export async function requirePorteiro(): Promise<PortariaTenantContext> {
  const ctx = await getTenantContext();
  if (
    ctx.kind !== 'tenant' ||
    (ctx.role !== 'porteiro' &&
      ctx.role !== 'admin_master' &&
      ctx.role !== 'admin_funcionario')
  ) {
    throw new ForbiddenError('Acesso negado');
  }
  return {
    kind: 'tenant',
    userId: ctx.userId,
    condominioId: ctx.condominioId,
    role: ctx.role,
  };
}
