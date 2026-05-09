import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { NotFoundError } from '@/server/errors';
import { getMoradorById, restoreMorador } from '@/lib/db/morador';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/moradores:restore', morador_id: id });
  try {
    await requireAdminMaster();
    const existing = await getMoradorById(id, true);
    if (!existing) throw new NotFoundError('Morador não encontrado');
    if (!existing.deleted_at) {
      return NextResponse.json({ ok: true, message: 'Já está ativo', already_active: true });
    }
    const restored = await restoreMorador(id);
    log.info('morador restaurado');
    return NextResponse.json({ ok: true, morador: restored });
  } catch (err) {
    return handleApiError(err, log);
  }
}
