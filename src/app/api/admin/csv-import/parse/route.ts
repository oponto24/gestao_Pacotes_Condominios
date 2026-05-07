import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requireAdmin } from '@/lib/api/admin-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError } from '@/server/errors';
import { parseImportCsv, MAX_ROWS } from '@/lib/csv/parse-import';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_BYTES = 256 * 1024; // 256KB

const ACCEPTED_CONTENT_TYPES = new Set([
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/csv',
]);

/**
 * POST /api/admin/csv-import/parse
 *
 * Recebe multipart/form-data com campo `file` contendo CSV de unidades + morador principal.
 * NÃO persiste — apenas devolve o ParseResult para a UI da story 2.6 fazer preview + commit.
 */
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'admin/csv-import:parse' });
  try {
    const ctx = await requireAdmin();

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      throw new ValidationError('Esperado multipart/form-data com campo "file"');
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ValidationError('Campo "file" obrigatório');
    }

    if (file.size === 0) {
      throw new ValidationError('Arquivo vazio');
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new ValidationError(
        `Arquivo excede o limite de ${Math.round(MAX_FILE_BYTES / 1024)}KB (recebido: ${Math.round(file.size / 1024)}KB)`,
      );
    }

    const contentType = (file.type || '').toLowerCase();
    // Excel/SO podem mandar content-type vazio; aceitar se a extensão for .csv
    const fileName = (file.name || '').toLowerCase();
    const hasValidType = ACCEPTED_CONTENT_TYPES.has(contentType) || fileName.endsWith('.csv') || fileName.endsWith('.txt');
    if (!hasValidType) {
      throw new ValidationError(
        `Content-Type não suportado: ${contentType || '(vazio)'}. Use .csv ou .txt UTF-8.`,
      );
    }

    const text = await file.text();
    const result = parseImportCsv(text);

    if (result.kind === 'fatal') {
      log.warn(
        { condominio_id: ctx.condominioId, code: result.code, file_size: file.size },
        'csv parse fatal',
      );
      // Erros fatais retornam 400 — ainda assim com payload estruturado
      return NextResponse.json(result, { status: 400 });
    }

    log.info(
      {
        condominio_id: ctx.condominioId,
        valid: result.valid.length,
        invalid: result.invalid.length,
        total: result.totalRows,
        max_rows: MAX_ROWS,
      },
      'csv parse ok',
    );

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, log);
  }
}
