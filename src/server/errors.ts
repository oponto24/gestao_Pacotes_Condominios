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

export class CondominioSuspendedError extends TenantError {
  constructor(message = 'Seu condomínio está temporariamente suspenso. Contate o suporte.') {
    super(message, 403, 'condominio_suspended');
  }
}

export class ForbiddenError extends TenantError {
  constructor(message = 'Acesso negado') {
    super(message, 403, 'forbidden');
  }
}

export class NotFoundError extends TenantError {
  constructor(message = 'Recurso não encontrado') {
    super(message, 404, 'not_found');
  }
}

export class ConflictError extends TenantError {
  constructor(message = 'Conflito') {
    super(message, 409, 'conflict');
  }
}

export class ValidationError extends TenantError {
  constructor(
    message = 'Dados inválidos',
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message, 400, 'validation_error');
  }
}

export function isTenantError(e: unknown): e is TenantError {
  return e instanceof TenantError;
}
