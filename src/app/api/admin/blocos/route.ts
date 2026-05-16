import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ConflictError } from '@/server/errors';
import { blocoCreateSchema, blocoListQuerySchema } from '@/lib/validators/bloco';
import { createBloco, findBlocoByNome, listBlocos } from '@/lib/db/bloco';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/blocos:list' });
  try {
    const ctx = await requireAdminMaster();
    const url = new URL(req.url);
    const query = blocoListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listBlocos({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      includeInativos: query.include_inativos,
    });
    log.info({ condominio_id: ctx.condominioId, total: result.total }, 'lista entregue');
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/blocos:create' });
  try {
    const ctx = await requireAdminMaster();
    const body = await req.json();
    const data = blocoCreateSchema.parse(body);

    const existing = await findBlocoByNome(data.nome);
    if (existing) {
      throw new ConflictError(`Ja existe um bloco com o nome "${data.nome}"`);
    }

    const created = await createBloco(data, ctx.condominioId);
    log.info({ condominio_id: ctx.condominioId, bloco_id: created.id }, 'bloco criado');
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err, log);
  }
}
