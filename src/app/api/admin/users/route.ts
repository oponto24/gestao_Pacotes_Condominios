import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { handleApiError } from '@/lib/api/handle-error';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { ValidationError } from '@/server/errors';
import { userCreateAdminSchema } from '@/lib/validators/user-create';
import { createPendingUser } from '@/lib/db/user-management';
import { writeAuditLog } from '@/lib/audit/write-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/users (stories 8.6 + 8.7)
 *
 * Admin cadastra outro admin OU porteiro do MESMO cond.
 * Tenant isolation: condominio_id sempre vem do contexto, NÃO do body.
 */
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin:create-user' });
  try {
    const ctx = await requireAdminMaster();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Body inválido');
    }
    const parsed = userCreateAdminSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }

    const created = await createPendingUser({
      email: parsed.data.email,
      nome: parsed.data.nome,
      role: parsed.data.role,
      condominioId: ctx.condominioId,
    });

    await writeAuditLog({
      userId: ctx.userId,
      condominioId: ctx.condominioId,
      acao:
        parsed.data.role === 'admin_master' || parsed.data.role === 'admin_funcionario'
          ? 'admin_created_by_admin'
          : 'porteiro_created_by_admin',
      entidadeTipo: 'user',
      entidadeId: created.id,
      metadata: { email: created.email, nome: created.nome, role: created.role },
      request: req,
    });

    log.info(
      { new_user_id: created.id, role: created.role, cond: ctx.condominioId },
      'User criado pelo admin',
    );

    return NextResponse.json(
      {
        ok: true,
        user: { id: created.id, email: created.email, nome: created.nome, role: created.role },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err, log);
  }
}
