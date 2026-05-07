import { NextResponse } from 'next/server';
import { loggerForRequest } from '@/lib/logger';
import { requirePorteiro } from '@/lib/api/portaria-guard';
import { handleApiError } from '@/lib/api/handle-error';
import { ValidationError } from '@/server/errors';
import { pacoteCreateInputSchema } from '@/lib/validators/pacote-create';
import {
  savePacoteFoto,
  deletePacoteFoto,
} from '@/lib/storage/pacote-foto';
import { createPacoteRascunho } from '@/lib/db/pacote';
import { enqueue } from '@/lib/queue/queues';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_MIMES = new Set(['image/jpeg', 'image/png']);

/**
 * POST /api/pacotes (story 3.4)
 *
 * Recebe multipart/form-data com:
 *   - file: Blob JPEG/PNG (obrigatório, max 5MB)
 *   - codigo_rastreio: string opcional
 *
 * Cria pacote em estado `rascunho`, salva foto no storage e enfileira job
 * `extractLabel` para a IA (story 3.5) processar.
 *
 * Acesso: porteiro ou admin (substituição). Super-admin é redirecionado
 * pelo guard.
 */
export async function POST(req: Request) {
  const log = loggerForRequest(req).child({ scope: 'pacotes:create' });
  let savedFotoPath: string | null = null;
  try {
    const ctx = await requirePorteiro();

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      throw new ValidationError('Esperado multipart/form-data com campo "file"');
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ValidationError('Campo "file" obrigatório');
    }
    if (file.size === 0) {
      throw new ValidationError('Foto vazia');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new ValidationError(
        `Foto excede o limite de ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB (recebido: ${Math.round(file.size / 1024 / 1024)}MB)`,
      );
    }
    const mimeType = (file.type || '').toLowerCase();
    if (!ACCEPTED_MIMES.has(mimeType)) {
      throw new ValidationError(
        `Mime type não suportado: ${mimeType || '(vazio)'}. Use image/jpeg ou image/png.`,
      );
    }

    const codigoRastreioRaw = formData.get('codigo_rastreio');
    const codigoRastreioInput =
      typeof codigoRastreioRaw === 'string' ? codigoRastreioRaw : '';
    const validatedTextual = pacoteCreateInputSchema.parse({
      codigo_rastreio: codigoRastreioInput,
    });

    // Pré-gera pacote_id antes de salvar foto pra ter path determinístico.
    // Usa randomUUID nativo Node — Postgres gera depois mas usamos esse UUID
    // como prefixo do storage path. NÃO gravado no DB ainda.
    const pacoteIdProvisorio = crypto.randomUUID();

    // Lê buffer e salva foto no storage ANTES da transação DB.
    // Se DB falhar, cleanup best-effort no catch externo.
    const buffer = Buffer.from(await file.arrayBuffer());
    const fotoMetadata = await savePacoteFoto({
      condominioId: ctx.condominioId,
      pacoteId: pacoteIdProvisorio,
      buffer,
      mimeType,
    });
    savedFotoPath = fotoMetadata.storagePath;

    // Transação: cria pacote (com seu próprio UUID gerado pelo Postgres),
    // pacote_foto, pacote_evento. Note que o storage_path ficará referenciando
    // o pacoteIdProvisorio embutido no path; isso é OK — é só uma string.
    const { pacoteId, fotoId } = await createPacoteRascunho({
      condominioId: ctx.condominioId,
      userId: ctx.userId,
      codigoRastreio: validatedTextual.codigo_rastreio,
      foto: {
        storagePath: fotoMetadata.storagePath,
        mimeType: fotoMetadata.mimeType,
        bytes: fotoMetadata.bytes,
        hashSha256: fotoMetadata.hashSha256,
      },
    });

    // Enfileira job IA FORA da transação (Redis down não bloqueia create).
    // jobId = pacoteId garante idempotência (BullMQ não duplica).
    try {
      await enqueue(
        'extractLabel',
        { pacote_id: pacoteId, condominio_id: ctx.condominioId },
        { jobId: pacoteId },
      );
    } catch (queueErr) {
      log.error(
        { err: queueErr, pacote_id: pacoteId },
        'falha ao enfileirar extractLabel — pacote ficou em rascunho',
      );
      // NÃO falha o request — pacote criado é mais importante que job
    }

    log.info(
      {
        condominio_id: ctx.condominioId,
        actor_user_id: ctx.userId,
        pacote_id: pacoteId,
        foto_id: fotoId,
        bytes: fotoMetadata.bytes,
      },
      'pacote rascunho criado',
    );

    return NextResponse.json(
      {
        pacote_id: pacoteId,
        foto_storage_path: fotoMetadata.storagePath,
        status: 'rascunho',
      },
      { status: 201 },
    );
  } catch (err) {
    // Cleanup best-effort: se foto foi salva mas DB falhou, tenta deletar
    if (savedFotoPath) {
      await deletePacoteFoto(savedFotoPath);
    }
    return handleApiError(err, log);
  }
}
