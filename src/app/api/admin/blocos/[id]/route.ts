import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ConflictError, NotFoundError } from '@/server/errors';
import { blocoUpdateSchema } from '@/lib/validators/bloco';
import { findBlocoByNome, getBlocoById, softDeleteBloco, updateBloco } from '@/lib/db/bloco';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/blocos:get', bloco_id: id });
  try {
    await requireAdminMaster();
    const bloco = await getBlocoById(id);
    if (!bloco) throw new NotFoundError('Bloco nao encontrado');
    return NextResponse.json(bloco);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/blocos:update', bloco_id: id });
  try {
    await requireAdminMaster();
    const body = await req.json();
    const data = blocoUpdateSchema.parse(body);

    const existing = await getBlocoById(id);
    if (!existing) throw new NotFoundError('Bloco nao encontrado');

    if (data.nome && data.nome !== existing.nome) {
      const conflict = await findBlocoByNome(data.nome, id);
      if (conflict) throw new ConflictError(`Ja existe um bloco com o nome "${data.nome}"`);
    }

    const updated = await updateBloco(id, data);
    log.info({ changed: Object.keys(data) }, 'bloco atualizado');
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/blocos:delete', bloco_id: id });
  try {
    await requireAdminMaster();
    const existing = await getBlocoById(id);
    if (!existing) throw new NotFoundError('Bloco nao encontrado');

    const updated = await softDeleteBloco(id);
    log.info('bloco desativado (soft delete)');
    return NextResponse.json({ ok: true, bloco: updated });
  } catch (err) {
    return handleApiError(err, log);
  }
}
