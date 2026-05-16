import { cache } from 'react';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  UnauthorizedError,
  PendingProvisioningError,
  NoCondominioAssignedError,
  CondominioSuspendedError,
} from '@/server/errors';

/**
 * Cookie de impersonate (story 8.2).
 * Setado pelo POST /api/super-admin/impersonate/start, lido aqui no tenant context.
 * Apenas super-admin tem efeito; admin/porteiro com cookie é ignorado.
 */
export const IMPERSONATE_COOKIE = 'impersonate_condominio_id';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resultado do tenant context. Discriminado por `kind` para
 * forçar o consumidor a tratar `super_admin` separadamente.
 */
export type TenantRole = 'admin_master' | 'admin_funcionario' | 'porteiro';

export type TenantContext =
  | { kind: 'tenant'; userId: string; condominioId: string; role: TenantRole }
  | { kind: 'super_admin'; userId: string };

/**
 * Resolve contexto tenant do request atual.
 *
 * Cached via `react.cache()`: múltiplas chamadas no mesmo request
 * server retornam o mesmo resultado sem re-fetch do user.
 *
 * Story 8.2: super-admin com cookie de impersonate vira tenant admin do cond
 * impersonado (RLS aplica como admin do cond).
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
    // Impersonate: super-admin ativo vira tenant do cond escolhido
    const impersonatedId = await readImpersonateCookie();
    if (impersonatedId) {
      const cond = await db.condominio.findFirst({
        where: { id: impersonatedId, ativo: true, deleted_at: null },
        select: { id: true },
      });
      if (cond) {
        return {
          kind: 'tenant',
          userId: user.id,
          condominioId: cond.id,
          role: 'admin_master',
        };
      }
      // Cookie aponta pra cond inexistente/inativo: retorna super_admin normal.
      // Limpeza do cookie acontece em rota /stop ou em um middleware futuro.
    }
    return { kind: 'super_admin', userId: user.id };
  }

  if (!user.condominio_id) {
    throw new NoCondominioAssignedError();
  }

  // Story 12.2: bloqueia login se condomínio está suspenso
  const cond = await db.condominio.findFirst({
    where: { id: user.condominio_id, deleted_at: null },
    select: { ativo: true },
  });
  if (!cond || !cond.ativo) {
    throw new CondominioSuspendedError();
  }

  return {
    kind: 'tenant',
    userId: user.id,
    condominioId: user.condominio_id,
    // Garantido pelo schema (UserRole enum), mas TS não infere após o guard acima
    role: user.role as TenantRole,
  };
});

/**
 * Lê o cookie de impersonate. Retorna o UUID se válido, senão null.
 * Não valida no DB (isso é feito em getTenantContext).
 */
async function readImpersonateCookie(): Promise<string | null> {
  try {
    const store = await cookies();
    const value = store.get(IMPERSONATE_COOKIE)?.value;
    if (!value || !UUID_RE.test(value)) return null;
    return value;
  } catch {
    // Em contextos onde cookies() não funciona (ex: edge middleware), retorna null
    return null;
  }
}

/**
 * Helper pra detectar se o request atual está em modo impersonate.
 * Útil pro banner UI.
 */
export async function getImpersonationInfo(): Promise<{
  active: boolean;
  condominioId: string | null;
  condominioNome: string | null;
}> {
  const id = await readImpersonateCookie();
  if (!id) return { active: false, condominioId: null, condominioNome: null };
  const cond = await db.condominio.findFirst({
    where: { id, ativo: true, deleted_at: null },
    select: { id: true, nome: true },
  });
  if (!cond) return { active: false, condominioId: null, condominioNome: null };
  return { active: true, condominioId: cond.id, condominioNome: cond.nome };
}
