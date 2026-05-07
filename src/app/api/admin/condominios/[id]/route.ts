import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireSuperAdmin } from '@/lib/api/super-admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ConflictError, NotFoundError } from '@/server/errors';
import { condominioUpdateSchema } from '@/lib/validators/condominio';
import {
  archiveCondominio,
  findCondominioByCnpj,
  getCondominioById,
  updateCondominio,
} from '@/lib/db/condominio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/condominios:get', condominio_id: id });
  try {
    await requireSuperAdmin();
    const url = new URL(req.url);
    const includeArquivados = url.searchParams.get('include_arquivados') === 'true';
    const condo = await getCondominioById(id, includeArquivados);
    if (!condo) throw new NotFoundError('Condomínio não encontrado');
    return NextResponse.json(condo);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/condominios:update', condominio_id: id });
  try {
    await requireSuperAdmin();
    const body = await req.json();
    const data = condominioUpdateSchema.parse(body);

    const existing = await getCondominioById(id, true);
    if (!existing) throw new NotFoundError('Condomínio não encontrado');

    if (data.cnpj && data.cnpj !== existing.cnpj) {
      const conflict = await findCondominioByCnpj(data.cnpj, id);
      if (conflict) throw new ConflictError('CNPJ já em uso por outro condomínio');
    }

    const updated = await updateCondominio(id, data);
    log.info({ changed: Object.keys(data) }, 'condomínio atualizado');
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/condominios:archive', condominio_id: id });
  try {
    await requireSuperAdmin();
    const existing = await getCondominioById(id, false);
    if (!existing) throw new NotFoundError('Condomínio não encontrado ou já arquivado');

    const archived = await archiveCondominio(id);
    log.info({ archived_at: archived.deleted_at }, 'condomínio arquivado');
    return NextResponse.json({ ok: true, archived_at: archived.deleted_at });
  } catch (err) {
    return handleApiError(err, log);
  }
}
