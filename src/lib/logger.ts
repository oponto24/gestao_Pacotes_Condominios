import { pino, type Logger } from 'pino';
import type { TenantContext } from '@/server/middleware/tenant';

/**
 * Logger raiz — estruturado JSON em prod, pretty em dev.
 *
 * - Singleton via globalThis (evita N instances em hot reload)
 * - LOG_LEVEL configurável (default 'info')
 * - redact protege contra leak de secrets em qualquer field
 *
 * Uso:
 *   import { logger, loggerForRequest, loggerForJob, loggerForTenant } from '@/lib/logger';
 *   logger.info({ user_id }, 'mensagem');
 */

const globalForLogger = globalThis as unknown as { logger?: Logger };

const isProduction = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL ?? 'info';

export const logger: Logger =
  globalForLogger.logger ??
  pino({
    level,
    redact: {
      paths: [
        '*.password',
        '*.secret',
        '*.token',
        '*.authorization',
        'password',
        'secret',
        'token',
        'authorization',
        '*.headers.authorization',
        '*.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
    transport: isProduction
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
  });

if (process.env.NODE_ENV !== 'production') globalForLogger.logger = logger;

/**
 * Gera UUID v4 simples (sem dep externa). Usado pra request_id se não vier
 * do header `x-request-id`.
 */
function generateRequestId(): string {
  // crypto.randomUUID() está disponível em Node 18+ e edge runtime
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback simples (não-criptográfico) — só pra correlação de logs
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Child logger pra contexto de request HTTP.
 * Usa header `x-request-id` se presente; senão gera novo.
 */
export function loggerForRequest(req: Request | { headers?: Headers; id?: string }): Logger {
  let requestId: string | null = null;
  if (req instanceof Request) {
    requestId = req.headers.get('x-request-id');
  } else if (req && typeof req === 'object') {
    if ('id' in req && req.id) requestId = req.id;
    else if (req.headers instanceof Headers) requestId = req.headers.get('x-request-id');
  }
  return logger.child({ request_id: requestId ?? generateRequestId() });
}

/**
 * Child logger pra contexto de BullMQ job.
 */
export function loggerForJob(job: { id?: string | null; name: string }): Logger {
  return logger.child({
    job_id: job.id ?? 'unknown',
    job_name: job.name,
  });
}

/**
 * Child logger pra contexto tenant (multi-tenancy).
 *
 * IMPORTANTE: recebe `ctx` direto, NÃO chama getTenantContext() interno
 * (poderia lançar erros tenant em contextos sem auth).
 */
export function loggerForTenant(ctx: TenantContext): Logger {
  if (ctx.kind === 'super_admin') {
    return logger.child({ user_id: ctx.userId, super_admin: true });
  }
  return logger.child({
    user_id: ctx.userId,
    condominio_id: ctx.condominioId,
    role: ctx.role,
  });
}
