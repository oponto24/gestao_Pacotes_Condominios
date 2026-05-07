import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdmin } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ConflictError } from '@/server/errors';
import {
  setorCreateSchema,
  setorListQuerySchema,
} from '@/lib/validators/setor';
import {
  createSetor,
  findSetorByNome,
  listSetores,
} from '@/lib/db/setor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/setores:list' });
  try {
    const ctx = await requireAdmin();
    const url = new URL(req.url);
    const query = setorListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listSetores({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      includeInativos: query.include_inativos,
    });
    log.info(
      { condominio_id: ctx.condominioId, total: result.total },
      'lista entregue',
    );
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/setores:create' });
  try {
    const ctx = await requireAdmin();
    const body = await req.json();
    const data = setorCreateSchema.parse(body);

    const existing = await findSetorByNome(data.nome);
    if (existing) {
      throw new ConflictError(`Já existe um setor com o nome "${data.nome}"`);
    }

    const created = await createSetor(data, ctx.condominioId);
    log.info({ condominio_id: ctx.condominioId, setor_id: created.id }, 'setor criado');
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err, log);
  }
}
