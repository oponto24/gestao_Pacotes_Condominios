import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { Logger } from 'pino';
import { isTenantError, ValidationError } from '@/server/errors';

/**
 * Mapeia erros conhecidos pra responses HTTP padronizadas.
 * Loga o erro com contexto antes de responder.
 */
export function handleApiError(err: unknown, log: Logger): NextResponse {
  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || '_root';
      (fields[path] ??= []).push(issue.message);
    }
    log.warn({ fields }, 'validação falhou');
    return NextResponse.json(
      { ok: false, code: 'validation_error', message: 'Dados inválidos', fields },
      { status: 400 },
    );
  }

  if (err instanceof ValidationError) {
    log.warn({ fields: err.fields }, err.message);
    return NextResponse.json(
      { ok: false, code: err.code, message: err.message, fields: err.fields },
      { status: err.httpStatus },
    );
  }

  if (isTenantError(err)) {
    log.warn({ code: err.code }, err.message);
    return NextResponse.json(
      { ok: false, code: err.code, message: err.message },
      { status: err.httpStatus },
    );
  }

  log.error({ err: err instanceof Error ? err.message : err }, 'erro interno');
  return NextResponse.json({ ok: false, code: 'internal_error' }, { status: 500 });
}
