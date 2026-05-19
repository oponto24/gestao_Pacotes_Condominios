import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { handleApiError } from '@/lib/api/handle-error';
import { getTenantContext } from '@/server/middleware/tenant';
import { ForbiddenError, ValidationError } from '@/server/errors';
import { parseIdParam } from '@/lib/validators/_shared';
import { criarDespesaInputSchema } from '@/lib/validators/despesa';
import { atualizarDespesa, removerDespesa } from '@/lib/db/despesa';
import { writeAuditLog } from '@/lib/audit/write-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/** PATCH /api/super-admin/despesas/[id] — edita despesa existente. */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const log = loggerForRequest(req).child({ scope: 'super-admin:editar-despesa' });
  try {
    const id = parseIdParam((await params).id);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const ctx = await getTenantContext();
    if (ctx.kind !== 'super_admin') {
      throw new ForbiddenError('Apenas super-admin');
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Body inválido');
    }
    const parsed = criarDespesaInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      );
    }

    const updated = await atualizarDespesa(id, parsed.data);

    await writeAuditLog({
      userId: ctx.userId,
      condominioId: null,
      acao: 'super_admin.despesa.atualizada',
      entidadeTipo: 'despesa',
      entidadeId: updated.id,
      metadata: {
        servico: updated.servico,
        valor_brl: updated.valor_brl,
      },
      request: req,
    });

    log.info({ despesa_id: updated.id }, 'despesa atualizada');
    return NextResponse.json({ ok: true, despesa: updated });
  } catch (err) {
    return handleApiError(err, log);
  }
}

/** DELETE /api/super-admin/despesas/[id] — remove despesa. */
export async function DELETE(req: Request, { params }: RouteCtx) {
  const log = loggerForRequest(req).child({ scope: 'super-admin:remover-despesa' });
  try {
    const id = parseIdParam((await params).id);
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const ctx = await getTenantContext();
    if (ctx.kind !== 'super_admin') {
      throw new ForbiddenError('Apenas super-admin');
    }

    await removerDespesa(id);

    await writeAuditLog({
      userId: ctx.userId,
      condominioId: null,
      acao: 'super_admin.despesa.removida',
      entidadeTipo: 'despesa',
      entidadeId: id,
      request: req,
    });

    log.info({ despesa_id: id }, 'despesa removida');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, log);
  }
}
