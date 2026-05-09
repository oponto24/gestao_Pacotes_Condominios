import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loggerForRequest } from '@/lib/logger';
import { requireAdminMaster } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError } from '@/server/errors';
import { csvRowSchema } from '@/lib/validators/csv-import';
import { commitImport } from '@/lib/csv/commit-import';
import type { ValidRow } from '@/lib/csv/parse-import';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_ROWS = 1000;

const inputSchema = z.object({
  rows: z
    .array(csvRowSchema.extend({ linha: z.number().int().positive() }))
    .min(1, 'Lista de linhas vazia')
    .max(MAX_ROWS, `Máximo ${MAX_ROWS} linhas`),
});

/**
 * POST /api/admin/csv-import/commit
 *
 * Commit transacional do batch CSV. Cria N unidades + N moradores
 * principais em uma única transação. Qualquer erro → rollback completo.
 *
 * Espera receber APENAS as linhas que passaram tanto pelo parser quanto
 * pela validação cross-DB (`okToCreate` da etapa anterior).
 */
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/csv-import:commit' });
  try {
    const ctx = await requireAdminMaster();
    const body = await req.json().catch(() => null);
    if (!body) throw new ValidationError('JSON inválido');

    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Linhas inválidas no payload', {
        rows: parsed.error.issues.map((i) => i.message),
      });
    }

    const result = await commitImport(parsed.data.rows as ValidRow[]);

    log.info(
      {
        scope: 'csv-import:commit',
        condominio_id: ctx.condominioId,
        actor_user_id: ctx.userId,
        unidades_criadas: result.created.unidades,
        moradores_criados: result.created.moradores,
        duration_ms: result.duration_ms,
      },
      'csv commit ok',
    );

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, log);
  }
}
