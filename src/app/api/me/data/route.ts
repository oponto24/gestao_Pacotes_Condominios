import { NextResponse } from 'next/server';
import { withTenant } from '@/server/db-tenant';
import { isTenantError } from '@/server/errors';
import { loggerForRequest } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Smoke endpoint do middleware tenant: retorna unidades visíveis
 * pelo usuário atual com RLS aplicado.
 *
 * - super_admin: vê todas as unidades de todos os condomínios
 * - admin/porteiro: vê SÓ unidades do próprio condomínio
 * - sem condominio_id: erro 403
 * - não autenticado: erro 401
 */
export async function GET(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'api/me/data' });
  try {
    const unidades = await withTenant(async (tx) => {
      return tx.unidade.findMany({
        select: {
          id: true,
          identificador: true,
          bloco: true,
          condominio_id: true,
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
    });
    return NextResponse.json({ count: unidades.length, unidades });
  } catch (err) {
    if (isTenantError(err)) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    log.error({ err }, 'erro inesperado');
    return NextResponse.json({ ok: false, code: 'internal_error' }, { status: 500 });
  }
}
