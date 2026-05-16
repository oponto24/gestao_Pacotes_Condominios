import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { handleApiError } from '@/lib/api/handle-error';
import { getTenantContext } from '@/server/middleware/tenant';
import { ForbiddenError, NotFoundError } from '@/server/errors';
import { userUpdateSuperAdminSchema } from '@/lib/validators/user-create';
import { getUserById, updateUser } from '@/lib/db/user-management';
import { writeAuditLog } from '@/lib/audit/write-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/super-admin/users/[id] (story 12.3)
 * Edita nome, role, ou ativo de um usuario. Guards:
 * - Nao pode editar a si mesmo
 * - Nao pode promover a super_admin
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'super-admin:update-user', target_user_id: id });
  try {
    const tenantCtx = await getTenantContext();
    if (tenantCtx.kind !== 'super_admin') {
      throw new ForbiddenError('Apenas super-admin');
    }

    // Guard: nao pode editar a si mesmo
    if (tenantCtx.userId === id) {
      throw new ForbiddenError('Não é possível editar seu próprio usuário por esta rota');
    }

    const existing = await getUserById(id);
    if (!existing) throw new NotFoundError('Usuário não encontrado');

    // Guard: nao pode editar super_admin
    if (existing.role === 'super_admin') {
      throw new ForbiddenError('Não é possível editar outro super-admin');
    }

    const body = await req.json();
    const data = userUpdateSuperAdminSchema.parse(body);

    const updated = await updateUser(id, data);

    await writeAuditLog({
      userId: tenantCtx.userId,
      condominioId: existing.condominio_id,
      acao: data.ativo === false ? 'user_deactivated' : data.ativo === true ? 'user_reactivated' : 'user_updated',
      entidadeTipo: 'user',
      entidadeId: id,
      metadata: { changed: Object.keys(data) },
      request: req,
    });

    log.info({ changed: Object.keys(data) }, 'usuario atualizado pelo super-admin');
    return NextResponse.json({ ok: true, user: { id: updated.id, nome: updated.nome, role: updated.role, ativo: updated.ativo } });
  } catch (err) {
    return handleApiError(err, log);
  }
}
