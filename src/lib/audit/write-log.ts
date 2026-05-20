/**
 * Audit log helper (story 8.3).
 *
 * Insere registro em `audit_log` (tabela global, sem RLS).
 * Extrai IP e user_agent do request quando disponível.
 *
 * Uso típico em handlers de API:
 *   await writeAuditLog({
 *     userId: ctx.userId,
 *     condominioId: ctx.condominioId ?? null,
 *     acao: 'condominio_created',
 *     entidadeTipo: 'condominio',
 *     entidadeId: novoCond.id,
 *     metadata: { nome: novoCond.nome },
 *     request: req,
 *   });
 */

import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export interface WriteAuditLogInput {
  userId?: string | null;
  condominioId?: string | null;
  acao: string;
  entidadeTipo?: string | null;
  entidadeId?: string | null;
  metadata?: Record<string, unknown> | null;
  request?: Request | null;
}

/**
 * Extrai IP do request via headers padrão de proxies.
 * Ordem de preferência: X-Real-IP (Nginx), X-Forwarded-For (primeiro hop), CF-Connecting-IP.
 * Retorna null se nenhum encontrado (ex: testes sem request).
 */
export function extractIpFromRequest(req: Request | null | undefined): string | null {
  if (!req) return null;
  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.length > 0) return realIp;
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    // X-Forwarded-For: "client, proxy1, proxy2" — pega o primeiro
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp && cfIp.length > 0) return cfIp;
  return null;
}

export function extractUserAgent(req: Request | null | undefined): string | null {
  if (!req) return null;
  const ua = req.headers.get('user-agent');
  return ua && ua.length > 0 ? ua.slice(0, 500) : null; // truncate to schema VarChar(500)
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        user_id: input.userId ?? null,
        condominio_id: input.condominioId ?? null,
        acao: input.acao,
        entidade_tipo: input.entidadeTipo ?? null,
        entidade_id: input.entidadeId ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        ip_address: extractIpFromRequest(input.request),
        user_agent: extractUserAgent(input.request),
      },
    });
  } catch (err) {
    // Audit log nunca deve derrubar a operação principal
    console.error('[audit] falha ao gravar log:', err instanceof Error ? err.message : err);
  }
}
