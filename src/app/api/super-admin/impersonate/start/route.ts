import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loggerForRequest } from '@/lib/logger';
import { handleApiError } from '@/lib/api/handle-error';
import { getTenantContext, IMPERSONATE_COOKIE } from '@/server/middleware/tenant';
import { ForbiddenError, ValidationError, NotFoundError } from '@/server/errors';
import { db } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit/write-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const inputSchema = z.object({
  condominio_id: z.string().uuid('condominio_id inválido'),
});

/**
 * POST /api/super-admin/impersonate/start (story 8.2)
 *
 * Inicia modo impersonate. Apenas super-admin. Seta cookie httpOnly
 * com o condominio_id; subsequente getTenantContext() retorna tenant kind
 * em vez de super_admin.
 */
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'super-admin:impersonate:start' });
  try {
    const ctx = await getTenantContext();
    if (ctx.kind !== 'super_admin') {
      throw new ForbiddenError('Apenas super-admin pode impersonar');
    }

    const body = await req.json().catch(() => null);
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }

    // Rate limit: max 20 impersonate starts per hour per user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await db.auditLog.count({
      where: {
        user_id: ctx.userId,
        acao: 'impersonate_start',
        created_at: { gte: oneHourAgo },
      },
    });
    if (recentCount >= 20) {
      return NextResponse.json(
        { ok: false, message: 'Limite de impersonate atingido (20/hora)' },
        { status: 429 },
      );
    }

    const cond = await db.condominio.findFirst({
      where: { id: parsed.data.condominio_id, ativo: true, deleted_at: null },
      select: { id: true, nome: true },
    });
    if (!cond) throw new NotFoundError('Condomínio não encontrado ou inativo');

    await writeAuditLog({
      userId: ctx.userId,
      condominioId: cond.id,
      acao: 'impersonate_start',
      entidadeTipo: 'condominio',
      entidadeId: cond.id,
      metadata: { target_cond_nome: cond.nome },
      request: req,
    });

    log.info(
      { super_admin_id: ctx.userId, target_cond: cond.id, target_nome: cond.nome },
      'Impersonate iniciado',
    );

    const res = NextResponse.json({ ok: true, condominio: cond }, { status: 200 });
    res.cookies.set(IMPERSONATE_COOKIE, cond.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 horas
    });
    return res;
  } catch (err) {
    return handleApiError(err, log);
  }
}
