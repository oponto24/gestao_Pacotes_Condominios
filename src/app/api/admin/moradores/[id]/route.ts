import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ConflictError, NotFoundError } from '@/server/errors';
import { moradorUpdateSchema } from '@/lib/validators/morador';
import {
  archiveMorador,
  findMoradorByTelefone,
  getMoradorById,
  updateMorador,
} from '@/lib/db/morador';
import { auditUpdate, auditDelete } from '@/lib/audit/audited-mutation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/moradores:get', morador_id: id });
  try {
    await requireAdminMaster();
    const url = new URL(req.url);
    const includeArquivados = url.searchParams.get('include_arquivados') === 'true';
    const morador = await getMoradorById(id, includeArquivados);
    if (!morador) throw new NotFoundError('Morador não encontrado');
    return NextResponse.json(morador);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/moradores:update', morador_id: id });
  try {
    const adminCtx = await requireAdminMaster();
    const body = await req.json();
    const data = moradorUpdateSchema.parse(body);

    const existing = await getMoradorById(id);
    if (!existing) throw new NotFoundError('Morador não encontrado');

    if (data.telefone && data.telefone !== existing.telefone) {
      const conflict = await findMoradorByTelefone(data.telefone, id);
      if (conflict) {
        throw new ConflictError(`Telefone ${data.telefone} já cadastrado para outro morador`);
      }
    }

    const updated = await updateMorador(id, data);
    await auditUpdate(
      { userId: adminCtx.userId, condominioId: adminCtx.condominioId, request: req },
      'morador', id, existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>,
    );
    log.info({ changed: Object.keys(data) }, 'morador atualizado');
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err, log);
  }
}

/** Soft delete LGPD — seta deleted_at, NUNCA DELETE físico. */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/moradores:archive', morador_id: id });
  try {
    const adminCtx = await requireAdminMaster();
    const existing = await getMoradorById(id, false);
    if (!existing) throw new NotFoundError('Morador não encontrado ou já arquivado');

    const archived = await archiveMorador(id);
    await auditDelete(
      { userId: adminCtx.userId, condominioId: adminCtx.condominioId, request: req },
      'morador', id, existing as unknown as Record<string, unknown>,
    );
    log.info({ archived_at: archived.deleted_at }, 'morador arquivado (soft delete LGPD)');
    return NextResponse.json({ ok: true, archived_at: archived.deleted_at });
  } catch (err) {
    return handleApiError(err, log);
  }
}
