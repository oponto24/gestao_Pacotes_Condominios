import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loggerForRequest } from '@/lib/logger';
import { requireAdmin } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError } from '@/server/errors';
import { csvRowSchema } from '@/lib/validators/csv-import';
import { validateAgainstDb } from '@/lib/csv/validate-db';
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
 * POST /api/admin/csv-import/validate-db
 *
 * Recebe linhas válidas do parser (story 2.5) e retorna split entre
 * `okToCreate` e `conflicting` (com unidade ou telefone JÁ existentes
 * no DB do tenant). NÃO persiste nada.
 */
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/csv-import:validate-db' });
  try {
    const ctx = await requireAdmin();
    const body = await req.json().catch(() => null);
    if (!body) throw new ValidationError('JSON inválido');

    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Linhas inválidas no payload', {
        rows: parsed.error.issues.map((i) => i.message),
      });
    }

    const result = await validateAgainstDb(parsed.data.rows as ValidRow[]);

    log.info(
      {
        condominio_id: ctx.condominioId,
        total: parsed.data.rows.length,
        ok: result.okToCreate.length,
        conflicting: result.conflicting.length,
      },
      'csv validate-db ok',
    );

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, log);
  }
}
