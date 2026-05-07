/**
 * Erros tenant-aware. Cada um carrega `httpStatus` para mapear em respostas API.
 */

export class TenantError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends TenantError {
  constructor(message = 'Autenticação requerida') {
    super(message, 401, 'unauthorized');
  }
}

export class PendingProvisioningError extends TenantError {
  constructor(message = 'Conta sincronizando — tente novamente em instantes') {
    super(message, 503, 'pending_provisioning');
  }
}

export class NoCondominioAssignedError extends TenantError {
  constructor(message = 'Usuário não está associado a nenhum condomínio') {
    super(message, 403, 'no_condominio_assigned');
  }
}

export function isTenantError(e: unknown): e is TenantError {
  return e instanceof TenantError;
}
