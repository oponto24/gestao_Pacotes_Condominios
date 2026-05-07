import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireSuperAdmin } from '@/lib/api/super-admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ConflictError } from '@/server/errors';
import {
  condominioCreateSchema,
  condominioListQuerySchema,
} from '@/lib/validators/condominio';
import {
  createCondominio,
  findCondominioByCnpj,
  listCondominios,
} from '@/lib/db/condominio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/condominios:list' });
  try {
    await requireSuperAdmin();
    const url = new URL(req.url);
    const query = condominioListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listCondominios({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      includeArquivados: query.include_arquivados,
    });
    log.info({ total: result.total, page: query.page }, 'lista entregue');
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/condominios:create' });
  try {
    await requireSuperAdmin();
    const body = await req.json();
    const data = condominioCreateSchema.parse(body);

    if (data.cnpj) {
      const existing = await findCondominioByCnpj(data.cnpj);
      if (existing) {
        throw new ConflictError(
          `CNPJ já cadastrado${existing.deleted_at ? ' (arquivado — restaure em vez de criar novo)' : ''}`,
        );
      }
    }

    const created = await createCondominio(data);
    log.info({ condominio_id: created.id }, 'condomínio criado');
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err, log);
  }
}
