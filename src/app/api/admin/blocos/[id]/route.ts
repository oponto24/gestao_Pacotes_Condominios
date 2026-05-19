import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors';
import { parseIdParam } from '@/lib/validators/_shared';
import { blocoUpdateSchema } from '@/lib/validators/bloco';
import { findBlocoByNome, getBlocoById, softDeleteBloco, updateBloco } from '@/lib/db/bloco';
import { auditUpdate, auditDelete } from '@/lib/audit/audited-mutation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Ctx) {
  const id = parseIdParam((await ctx.params).id);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
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
  const id = parseIdParam((await ctx.params).id);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const log = loggerForRequest(req).child({ scope: 'admin/blocos:update', bloco_id: id });
  try {
    const adminCtx = await requireAdminMaster();
    const body = await req.json();
    const data = blocoUpdateSchema.parse(body);

    const existing = await getBlocoById(id);
    if (!existing) throw new NotFoundError('Bloco nao encontrado');

    if (data.nome && data.nome !== existing.nome) {
      const conflict = await findBlocoByNome(data.nome, id);
      if (conflict) throw new ConflictError(`Ja existe um bloco com o nome "${data.nome}"`);
    }

    const updated = await updateBloco(id, data);
    await auditUpdate(
      { userId: adminCtx.userId, condominioId: adminCtx.condominioId, request: req },
      'bloco', id, existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>,
    );
    log.info({ changed: Object.keys(data) }, 'bloco atualizado');
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const id = parseIdParam((await ctx.params).id);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const log = loggerForRequest(req).child({ scope: 'admin/blocos:delete', bloco_id: id });
  try {
    const adminCtx = await requireAdminMaster();
    const existing = await getBlocoById(id);
    if (!existing) throw new NotFoundError('Bloco nao encontrado');

    const updated = await softDeleteBloco(id);
    await auditDelete(
      { userId: adminCtx.userId, condominioId: adminCtx.condominioId, request: req },
      'bloco', id, existing as unknown as Record<string, unknown>,
    );
    log.info('bloco desativado (soft delete)');
    return NextResponse.json({ ok: true, bloco: updated });
  } catch (err) {
    return handleApiError(err, log);
  }
}
