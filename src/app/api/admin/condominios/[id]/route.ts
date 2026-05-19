import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loggerForRequest } from '@/lib/logger';
import { requireSuperAdmin } from '@/lib/api/super-admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ConflictError, NotFoundError, ForbiddenError } from '@/server/errors';
import { parseIdParam } from '@/lib/validators/_shared';
import { condominioUpdateSchema } from '@/lib/validators/condominio';
import {
  archiveCondominio,
  deactivateCondominio,
  reactivateCondominio,
  findCondominioByCnpj,
  getCondominioById,
  updateCondominio,
} from '@/lib/db/condominio';
import { IMPERSONATE_COOKIE } from '@/server/middleware/tenant';
import { auditUpdate, auditDelete } from '@/lib/audit/audited-mutation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Ctx) {
  const id = parseIdParam((await ctx.params).id);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
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
  const id = parseIdParam((await ctx.params).id);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const log = loggerForRequest(req).child({ scope: 'admin/condominios:update', condominio_id: id });
  try {
    const superCtx = await requireSuperAdmin();
    const body = await req.json();
    const data = condominioUpdateSchema.parse(body);

    const existing = await getCondominioById(id, true);
    if (!existing) throw new NotFoundError('Condomínio não encontrado');

    // Story 12.2: se está alterando ativo, verifica se não está impersonando esse condomínio
    if (data.ativo !== undefined && data.ativo !== existing.ativo) {
      const store = await cookies();
      const impersonatedId = store.get(IMPERSONATE_COOKIE)?.value;
      if (impersonatedId === id) {
        throw new ForbiddenError('Não é possível desativar um condomínio que você está impersonando');
      }

      if (data.ativo === false) {
        await deactivateCondominio(id);
        await auditUpdate(
          { userId: superCtx.userId, condominioId: null, request: req },
          'condominio', id,
          existing as unknown as Record<string, unknown>,
          { ...existing, ativo: false } as unknown as Record<string, unknown>,
        );
        log.info('condomínio desativado (suspensão)');
        return NextResponse.json({ ok: true, ativo: false });
      } else {
        await reactivateCondominio(id);
        await auditUpdate(
          { userId: superCtx.userId, condominioId: null, request: req },
          'condominio', id,
          existing as unknown as Record<string, unknown>,
          { ...existing, ativo: true } as unknown as Record<string, unknown>,
        );
        log.info('condomínio reativado');
        return NextResponse.json({ ok: true, ativo: true });
      }
    }

    if (data.cnpj && data.cnpj !== existing.cnpj) {
      const conflict = await findCondominioByCnpj(data.cnpj, id);
      if (conflict) throw new ConflictError('CNPJ já em uso por outro condomínio');
    }

    const updated = await updateCondominio(id, data);
    await auditUpdate(
      { userId: superCtx.userId, condominioId: null, request: req },
      'condominio', id,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );
    log.info({ changed: Object.keys(data) }, 'condomínio atualizado');
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const id = parseIdParam((await ctx.params).id);
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const log = loggerForRequest(req).child({ scope: 'admin/condominios:archive', condominio_id: id });
  try {
    const superCtx = await requireSuperAdmin();
    const existing = await getCondominioById(id, false);
    if (!existing) throw new NotFoundError('Condomínio não encontrado ou já arquivado');

    const archived = await archiveCondominio(id);
    await auditDelete(
      { userId: superCtx.userId, condominioId: null, request: req },
      'condominio', id, existing as unknown as Record<string, unknown>,
    );
    log.info({ archived_at: archived.deleted_at }, 'condomínio arquivado');
    return NextResponse.json({ ok: true, archived_at: archived.deleted_at });
  } catch (err) {
    return handleApiError(err, log);
  }
}
