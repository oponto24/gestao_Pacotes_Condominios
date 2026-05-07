import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdmin } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ConflictError, NotFoundError } from '@/server/errors';
import { unidadeUpdateSchema } from '@/lib/validators/unidade';
import {
  deleteUnidade,
  findUnidadeByIdentificador,
  getUnidadeById,
  updateUnidade,
} from '@/lib/db/unidade';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/unidades:get', unidade_id: id });
  try {
    await requireAdmin();
    const unidade = await getUnidadeById(id);
    if (!unidade) throw new NotFoundError('Unidade não encontrada');
    return NextResponse.json(unidade);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/unidades:update', unidade_id: id });
  try {
    await requireAdmin();
    const body = await req.json();
    const data = unidadeUpdateSchema.parse(body);

    const existing = await getUnidadeById(id);
    if (!existing) throw new NotFoundError('Unidade não encontrada');

    // Conflito apenas se identificador OR bloco MUDAM
    const novoIdentificador = data.identificador ?? existing.identificador;
    const novoBloco = data.bloco !== undefined ? (data.bloco || null) : existing.bloco;
    const mudouChave =
      novoIdentificador !== existing.identificador || novoBloco !== existing.bloco;

    if (mudouChave) {
      const conflict = await findUnidadeByIdentificador(novoIdentificador, novoBloco, id);
      if (conflict) {
        throw new ConflictError(
          `Já existe uma unidade ${novoBloco ? `"${novoIdentificador}" no bloco "${novoBloco}"` : `"${novoIdentificador}" (sem bloco)`}`,
        );
      }
    }

    const updated = await updateUnidade(id, data);
    log.info({ changed: Object.keys(data) }, 'unidade atualizada');
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err, log);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const log = loggerForRequest(req).child({ scope: 'admin/unidades:delete', unidade_id: id });
  try {
    await requireAdmin();
    const existing = await getUnidadeById(id);
    if (!existing) throw new NotFoundError('Unidade não encontrada');

    if (existing._count.moradores > 0) {
      throw new ConflictError(
        `Unidade possui ${existing._count.moradores} morador(es) — remova/transfira antes de deletar`,
      );
    }
    if (existing._count.pacotes > 0) {
      throw new ConflictError(
        `Unidade possui ${existing._count.pacotes} pacote(s) — desative em vez de deletar`,
      );
    }

    await deleteUnidade(id);
    log.info('unidade deletada');
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    return handleApiError(err, log);
  }
}
