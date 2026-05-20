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

/**
 * POST /api/super-admin/users/[id]/send-email
 *
 * Gera link de acesso (sign-in token) pro admin compartilhar.
 * Se user é pending, cria no Clerk primeiro e atualiza clerk_id.
 */
export async function POST(req: Request, ctx: Ctx) {
  const id = parseIdParam((await ctx.params).id);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const log = loggerForRequest(req).child({ scope: 'super-admin:send-email', target_user_id: id });

  try {
    const tenantCtx = await getTenantContext();
    if (tenantCtx.kind !== 'super_admin') {
      throw new ForbiddenError('Apenas super-admin');
    }

    const user = await getUserById(id);
    if (!user) throw new NotFoundError('Usuário não encontrado');

    let clerkId = user.clerk_id;

    // Se pending, cria user no Clerk e atualiza o clerk_id no banco
    if (isPending(clerkId)) {
      const [firstName, ...rest] = user.nome.split(' ');
      const clerkUser = await clerk.users.createUser({
        emailAddress: [user.email],
        firstName,
        lastName: rest.join(' ') || undefined,
        skipPasswordRequirement: true,
      });
      clerkId = clerkUser.id;
      await db.user.update({
        where: { id: user.id },
        data: { clerk_id: clerkId },
      });
      log.info({ email: user.email }, 'user criado no Clerk (era pending)');
    }

    // Gera sign-in token
    const token = await clerk.signInTokens.createSignInToken({
      userId: clerkId,
      expiresInSeconds: 7 * 24 * 3600, // 7 dias
    });

    const appUrl = process.env.APP_URL ?? 'https://condominios.oponto24.com.br';
    const link = `${appUrl}/sign-in#/factor-one?__clerk_ticket=${token.token}`;

    log.info({ email: user.email }, 'link de acesso gerado');
    return NextResponse.json({ ok: true, action: 'sign_in_link', link });
  } catch (err) {
    return handleApiError(err, log);
  }
}
