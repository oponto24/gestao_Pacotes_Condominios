import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { handleApiError } from '@/lib/api/handle-error';
import { getCurrentUser } from '@/lib/auth';
import { IMPERSONATE_COOKIE } from '@/server/middleware/tenant';
import { writeAuditLog } from '@/lib/audit/write-log';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/super-admin/impersonate/stop (story 8.2)
 *
 * Encerra modo impersonate (limpa cookie). Audit log registrado.
 * Seguro de chamar mesmo sem impersonate ativo (no-op).
 */
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'super-admin:impersonate:stop' });
  try {
    // NÃO usa getTenantContext aqui (porque com cookie ativo retornaria tenant
    // em vez de super_admin — causaria loop). Lê user direto.
    const current = await getCurrentUser();
    const isSuperAdmin =
      current?.kind === 'authenticated' && current.user.role === 'super_admin';

    const store = await cookies();
    const previousCondId = store.get(IMPERSONATE_COOKIE)?.value ?? null;

    if (isSuperAdmin && previousCondId) {
      await writeAuditLog({
        userId: current.user.id,
        condominioId: previousCondId,
        acao: 'impersonate_stop',
        entidadeTipo: 'condominio',
        entidadeId: previousCondId,
        metadata: {},
        request: req,
      });
      log.info(
        { super_admin_id: current.user.id, previous_cond: previousCondId },
        'Impersonate encerrado',
      );
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(IMPERSONATE_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0, // expira imediatamente
    });
    return res;
  } catch (err) {
    return handleApiError(err, log);
  }
}
