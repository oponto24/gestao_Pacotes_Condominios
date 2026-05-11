import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { handleApiError } from '@/lib/api/handle-error';
import { getTenantContext } from '@/server/middleware/tenant';
import { ForbiddenError, ValidationError } from '@/server/errors';
import { criarDespesaInputSchema } from '@/lib/validators/despesa';
import { criarDespesa } from '@/lib/db/despesa';
import { writeAuditLog } from '@/lib/audit/write-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/super-admin/despesas — cria registro financeiro global. */
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'super-admin:criar-despesa' });
  try {
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

    const created = await criarDespesa(parsed.data);

    await writeAuditLog({
      userId: ctx.userId,
      condominioId: null,
      acao: 'super_admin.despesa.criada',
      entidadeTipo: 'despesa',
      entidadeId: created.id,
      metadata: {
        servico: created.servico,
        valor_brl: created.valor_brl,
      },
      request: req,
    });

    log.info({ despesa_id: created.id }, 'despesa criada');
    return NextResponse.json({ ok: true, despesa: created });
  } catch (err) {
    return handleApiError(err, log);
  }
}
