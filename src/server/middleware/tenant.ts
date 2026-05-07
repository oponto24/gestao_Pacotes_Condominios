import { cache } from 'react';
import { getCurrentUser } from '@/lib/auth';
import {
  UnauthorizedError,
  PendingProvisioningError,
  NoCondominioAssignedError,
} from '@/server/errors';

/**
 * Resultado do tenant context. Discriminado por `kind` para
 * forçar o consumidor a tratar `super_admin` separadamente.
 */
export type TenantContext =
  | { kind: 'tenant'; userId: string; condominioId: string; role: 'admin' | 'porteiro' }
  | { kind: 'super_admin'; userId: string };

/**
 * Resolve contexto tenant do request atual.
 *
 * Cached via `react.cache()`: múltiplas chamadas no mesmo request
 * server retornam o mesmo resultado sem re-fetch do user.
 *
 * Lança erros HTTP-mappable (UnauthorizedError, PendingProvisioningError,
 * NoCondominioAssignedError) — handlers de rota traduzem para JSON.
 */
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const current = await getCurrentUser();

  if (current === null) {
    throw new UnauthorizedError();
  }

  if (current.kind === 'pending_provisioning') {
    throw new PendingProvisioningError();
  }

  // current.kind === 'authenticated'
  const { user } = current;

  if (user.role === 'super_admin') {
    return { kind: 'super_admin', userId: user.id };
  }

  if (!user.condominio_id) {
    throw new NoCondominioAssignedError();
  }

  return {
    kind: 'tenant',
    userId: user.id,
    condominioId: user.condominio_id,
    // Garantido pelo schema (UserRole enum), mas TS não infere após o guard acima
    role: user.role as 'admin' | 'porteiro',
  };
});
