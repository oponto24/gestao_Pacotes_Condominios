import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireSuperAdmin } from '@/lib/api/super-admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { NotFoundError } from '@/server/errors';
import { parseIdParam } from '@/lib/validators/_shared';
import { getCondominioById, restoreCondominio } from '@/lib/db/condominio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: Ctx) {
  const id = parseIdParam((await ctx.params).id);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const log = loggerForRequest(req).child({ scope: 'admin/condominios:restore', condominio_id: id });
  try {
    await requireSuperAdmin();
    const existing = await getCondominioById(id, true);
    if (!existing) throw new NotFoundError('Condomínio não encontrado');
    if (!existing.deleted_at) {
      return NextResponse.json({ ok: true, message: 'Já está ativo', already_active: true });
    }

    const restored = await restoreCondominio(id);
    log.info('condomínio restaurado');
    return NextResponse.json({ ok: true, condominio: restored });
  } catch (err) {
    return handleApiError(err, log);
  }
}
