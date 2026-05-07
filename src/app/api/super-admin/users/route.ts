import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { handleApiError } from '@/lib/api/handle-error';
import { getTenantContext } from '@/server/middleware/tenant';
import { ForbiddenError, ValidationError } from '@/server/errors';
import { userCreateSuperAdminSchema } from '@/lib/validators/user-create';
import { createPendingUser } from '@/lib/db/user-management';
import { writeAuditLog } from '@/lib/audit/write-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/super-admin/users (story 8.5)
 *
 * Super-admin cadastra primeiro admin de um condomínio. Cria User com clerk_id
 * placeholder; webhook Clerk reconcilia por email no primeiro login.
 */
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'super-admin:create-user' });
  try {
    const ctx = await getTenantContext();
    if (ctx.kind !== 'super_admin') {
      throw new ForbiddenError('Apenas super-admin');
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Body inválido');
    }
    const parsed = userCreateSuperAdminSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }

    const created = await createPendingUser({
      email: parsed.data.email,
      nome: parsed.data.nome,
      role: 'admin',
      condominioId: parsed.data.condominio_id,
    });

    await writeAuditLog({
      userId: ctx.userId,
      condominioId: parsed.data.condominio_id,
      acao: 'admin_created',
      entidadeTipo: 'user',
      entidadeId: created.id,
      metadata: { email: created.email, nome: created.nome },
      request: req,
    });

    log.info(
      { admin_user_id: created.id, cond: parsed.data.condominio_id },
      'Admin criado pelo super-admin',
    );

    return NextResponse.json(
      { ok: true, user: { id: created.id, email: created.email, nome: created.nome } },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err, log);
  }
}
