import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ConflictError } from '@/server/errors';
import { unidadeCreateSchema, unidadeListQuerySchema } from '@/lib/validators/unidade';
import {
  createUnidade,
  findUnidadeByIdentificador,
  listUnidades,
} from '@/lib/db/unidade';
import { auditCreate } from '@/lib/audit/audited-mutation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/unidades:list' });
  try {
    const ctx = await requireAdminMaster();
    const url = new URL(req.url);
    const query = unidadeListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listUnidades({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      includeInativas: query.include_inativas,
    });
    log.info({ condominio_id: ctx.condominioId, total: result.total }, 'lista entregue');
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/unidades:create' });
  try {
    const ctx = await requireAdminMaster();
    const body = await req.json();
    const data = unidadeCreateSchema.parse(body);

    const existing = await findUnidadeByIdentificador(data.identificador, data.bloco);
    if (existing) {
      throw new ConflictError(
        `Já existe uma unidade ${formatUnidadeLabel(data.identificador, data.bloco)}`,
      );
    }

    const created = await createUnidade(data, ctx.condominioId);
    await auditCreate(
      { userId: ctx.userId, condominioId: ctx.condominioId, request: req },
      'unidade', created as unknown as Record<string, unknown>,
    );
    log.info({ condominio_id: ctx.condominioId, unidade_id: created.id }, 'unidade criada');
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err, log);
  }
}

function formatUnidadeLabel(identificador: string, bloco?: string | null): string {
  return bloco ? `"${identificador}" no bloco "${bloco}"` : `"${identificador}" (sem bloco)`;
}
