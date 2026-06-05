import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { handleApiError } from '@/lib/api/handle-error';
import { getTenantContext } from '@/server/middleware/tenant';
import { ForbiddenError, NotFoundError } from '@/server/errors';
import { parseIdParam } from '@/lib/validators/_shared';
import { getUserById, isPending, clerk } from '@/lib/db/user-management';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

function genTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  let pwd = '';
  for (let i = 0; i < 4; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 4; i++) pwd += digits[Math.floor(Math.random() * digits.length)];
  return pwd;
}

/**
 * POST /api/super-admin/users/[id]/send-email
 *
 * Pendente → cria user no Clerk com senha temporária
 * Ativo    → reseta senha com nova temporária
 *
 * Retorna as credenciais pro admin compartilhar.
 */
export async function POST(req: Request, ctx: Ctx) {
  const id = parseIdParam((await ctx.params).id);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const log = loggerForRequest(req).child({ scope: 'super-admin:reset-password', target_user_id: id });

  try {
    const tenantCtx = await getTenantContext();
    if (tenantCtx.kind !== 'super_admin') {
      throw new ForbiddenError('Apenas super-admin');
    }

    const user = await getUserById(id);
    if (!user) throw new NotFoundError('Usuário não encontrado');

    const tempPassword = genTempPassword();

    if (isPending(user.clerk_id)) {
      // Cria user no Clerk com senha
      const [firstName, ...rest] = user.nome.split(' ');
      const clerkUser = await clerk.users.createUser({
        emailAddress: [user.email],
        firstName,
        lastName: rest.join(' ') || undefined,
        password: tempPassword,
      });
      await db.user.update({
        where: { id: user.id },
        data: { clerk_id: clerkUser.id },
      });
      log.info({ email: user.email }, 'user criado no Clerk com senha temporária');
    } else {
      // Reseta senha do user existente no Clerk
      await clerk.users.updateUser(user.clerk_id, {
        password: tempPassword,
      });
      log.info({ email: user.email }, 'senha resetada');
    }

    return NextResponse.json({
      ok: true,
      email: user.email,
      tempPassword,
      message: 'Credenciais geradas. Copie agora — não serão exibidas novamente.',
    });
  } catch (err) {
    return handleApiError(err, log);
  }
}
