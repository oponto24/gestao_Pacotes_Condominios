import { getTenantContext } from '@/server/middleware/tenant';
import { ForbiddenError } from '@/server/errors';

/**
 * Guards de role-based access control (story 10.1 — Epic 10 hierarquia operacional).
 *
 * Roles disponíveis (PRD §3.8):
 *   - super_admin: operador SaaS, fora do condomínio (área /super-admin)
 *   - admin_master: síndico/admin geral do condomínio (cadastros, governança)
 *   - admin_funcionario: operacional da admin (organiza pacotes em condomínio com admin)
 *   - porteiro: opera a portaria (recebe + entrega)
 *
 * Story 10.1 introduz 4 níveis de granularidade pra suportar Epic 10 sem refactor adicional.
 * O alias `requireAdmin` é mantido como deprecated por 1 release pra evitar quebras silenciosas.
 */

type AdminRole = 'admin_master' | 'admin_funcionario';
type OperationalRole = AdminRole | 'porteiro';

export interface AdminMasterContext {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'admin_master';
}

export interface AdminFuncionarioContext {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: 'admin_funcionario';
}

export interface AdminAnyContext {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: AdminRole;
}

export interface AdminOrPorteiroContext {
  kind: 'tenant';
  userId: string;
  condominioId: string;
  role: OperationalRole;
}

/**
 * Exige role `admin_master` (síndico/admin geral). Usado em rotas de cadastros
 * (CRUDs em /admin/*) e configuração do condomínio.
 */
export async function requireAdminMaster(): Promise<AdminMasterContext> {
  const ctx = await getTenantContext();
  if (ctx.kind !== 'tenant' || ctx.role !== 'admin_master') {
    throw new ForbiddenError('Acesso negado');
  }
  return {
    kind: 'tenant',
    userId: ctx.userId,
    condominioId: ctx.condominioId,
    role: 'admin_master',
  };
}

/**
 * Exige role `admin_funcionario` (operacional da admin). Usado em rotas
 * exclusivas da equipe administrativa.
 */
export async function requireAdminFuncionario(): Promise<AdminFuncionarioContext> {
  const ctx = await getTenantContext();
  if (ctx.kind !== 'tenant' || ctx.role !== 'admin_funcionario') {
    throw new ForbiddenError('Acesso negado');
  }
  return {
    kind: 'tenant',
    userId: ctx.userId,
    condominioId: ctx.condominioId,
    role: 'admin_funcionario',
  };
}

/**
 * Aceita qualquer admin (`admin_master` ou `admin_funcionario`). Usado em rotas
 * compartilhadas pela equipe administrativa, como /administracao/* (story 10.5).
 */
export async function requireAdminAny(): Promise<AdminAnyContext> {
  const ctx = await getTenantContext();
  if (
    ctx.kind !== 'tenant' ||
    (ctx.role !== 'admin_master' && ctx.role !== 'admin_funcionario')
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

/**
 * Aceita qualquer role operacional: admin_master, admin_funcionario ou porteiro.
 * Usado em rotas de execução flexível (ex: bipe entrega final — story 10.7).
 * Super_admin não entra (tem sua área dedicada).
 */
export async function requireAdminOrPorteiro(): Promise<AdminOrPorteiroContext> {
  const ctx = await getTenantContext();
  if (
    ctx.kind !== 'tenant' ||
    (ctx.role !== 'admin_master' &&
      ctx.role !== 'admin_funcionario' &&
      ctx.role !== 'porteiro')
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

/**
 * @deprecated Use `requireAdminMaster` (alias preservado pra compatibilidade
 * após refactor da story 10.1). Será removido em release futura.
 */
export const requireAdmin = requireAdminMaster;

/**
 * @deprecated Use `AdminMasterContext` diretamente.
 */
export type AdminTenantContext = AdminMasterContext;
