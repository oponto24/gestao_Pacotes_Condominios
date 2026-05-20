import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { handleApiError } from '@/lib/api/handle-error';
import { getTenantContext } from '@/server/middleware/tenant';
import { ForbiddenError, ValidationError } from '@/server/errors';
import { userCreateSuperAdminSchema, userListQuerySchema } from '@/lib/validators/user-create';
import { createPendingUser, listAllUsers } from '@/lib/db/user-management';
import { writeAuditLog } from '@/lib/audit/write-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/super-admin/users (story 12.3)
 * Lista todos os usuarios (exceto super_admin) com filtros paginados.
 */
export async function GET(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'super-admin:list-users' });
  try {
    const ctx = await getTenantContext();
    if (ctx.kind !== 'super_admin') {
      throw new ForbiddenError('Apenas super-admin');
    }

    const url = new URL(req.url);
    const query = userListQuerySchema.parse(Object.fromEntries(url.searchParams));

    const result = await listAllUsers({
      page: query.page,
      pageSize: query.pageSize,
      role: query.role,
      condominioId: query.condominio_id,
      status: query.status,
      q: query.q,
    });

    log.info({ total: result.total }, 'lista usuarios entregue');
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, log);
  }
}

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

    const { user: created, tempPassword } = await createPendingUser({
      email: parsed.data.email,
      nome: parsed.data.nome,
      role: 'admin_master',
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
      {
        ok: true,
        user: { id: created.id, email: created.email, nome: created.nome },
        tempPassword,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err, log);
  }
}
