import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ConflictError, NotFoundError } from '@/server/errors';
import { moradorCreateSchema, moradorListQuerySchema } from '@/lib/validators/morador';
import {
  createMorador,
  findMoradorByTelefone,
  getUnidadeIdInTenant,
  listMoradores,
} from '@/lib/db/morador';
import { auditCreate } from '@/lib/audit/audited-mutation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/moradores:list' });
  try {
    const ctx = await requireAdminMaster();
    const url = new URL(req.url);
    const query = moradorListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listMoradores({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      unidadeId: query.unidade_id,
      includeInativos: query.include_inativos,
      includeArquivados: query.include_arquivados,
    });
    log.info({ condominio_id: ctx.condominioId, total: result.total }, 'lista entregue');
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/moradores:create' });
  try {
    const ctx = await requireAdminMaster();
    const body = await req.json();
    const data = moradorCreateSchema.parse(body);

    // Confirma que a unidade existe no tenant (RLS já isolaria, mas 404 é mais claro que erro Prisma)
    const unidade = await getUnidadeIdInTenant(data.unidade_id);
    if (!unidade) throw new NotFoundError('Unidade não encontrada neste condomínio');

    // Conflito por telefone (UNIQUE composite condominio_id + telefone)
    const existing = await findMoradorByTelefone(data.telefone);
    if (existing) {
      throw new ConflictError(`Telefone ${data.telefone} já cadastrado neste condomínio`);
    }

    const created = await createMorador(data, ctx.condominioId);
    await auditCreate(
      { userId: ctx.userId, condominioId: ctx.condominioId, request: req },
      'morador', created as unknown as Record<string, unknown>,
    );
    log.info(
      { condominio_id: ctx.condominioId, morador_id: created.id, is_principal: data.is_principal },
      'morador criado',
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err, log);
  }
}
