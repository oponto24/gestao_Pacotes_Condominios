import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ConflictError, NotFoundError } from '@/server/errors';
import { setorUpdateSchema } from '@/lib/validators/setor';
import {
  deleteSetor,
  findSetorByNome,
  getSetorById,
  updateSetor,
} from '@/lib/db/setor';
import { auditUpdate, auditDelete } from '@/lib/audit/audited-mutation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/setores:get', setor_id: id });
  try {
    await requireAdminMaster();
    const setor = await getSetorById(id);
    if (!setor) throw new NotFoundError('Setor não encontrado');
    return NextResponse.json(setor);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/setores:update', setor_id: id });
  try {
    const adminCtx = await requireAdminMaster();
    const body = await req.json();
    const data = setorUpdateSchema.parse(body);

    const existing = await getSetorById(id);
    if (!existing) throw new NotFoundError('Setor não encontrado');

    if (data.nome && data.nome !== existing.nome) {
      const conflict = await findSetorByNome(data.nome, id);
      if (conflict) throw new ConflictError(`Já existe um setor com o nome "${data.nome}"`);
    }

    const updated = await updateSetor(id, data);
    await auditUpdate(
      { userId: adminCtx.userId, condominioId: adminCtx.condominioId, request: req },
      'setor', id, existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>,
    );
    log.info({ changed: Object.keys(data) }, 'setor atualizado');
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/setores:delete', setor_id: id });
  try {
    const adminCtx = await requireAdminMaster();
    const existing = await getSetorById(id);
    if (!existing) throw new NotFoundError('Setor não encontrado');

    if (existing._count.pacotes > 0) {
      throw new ConflictError(
        `Setor possui ${existing._count.pacotes} pacote(s) — desative em vez de deletar`,
      );
    }

    await auditDelete(
      { userId: adminCtx.userId, condominioId: adminCtx.condominioId, request: req },
      'setor', id, existing as unknown as Record<string, unknown>,
    );
    await deleteSetor(id);
    log.info('setor deletado');
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    return handleApiError(err, log);
  }
}
