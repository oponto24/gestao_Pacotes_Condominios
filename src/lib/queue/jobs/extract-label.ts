import type { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { storage } from '@/lib/storage';
import { extractLabelFromImage } from '@/lib/anthropic/extract-label';
import { loggerForJob } from '@/lib/logger';

/**
 * Job `extractLabel` (story 3.5).
 *
 * Consumido pelo worker BullMQ. Carrega foto principal do pacote,
 * envia pra Claude Haiku 4.5 vision, valida JSON, e atualiza o
 * pacote em transação. Status NÃO muda aqui — fica `rascunho`
 * (story 3.7/3.8 movem para `pendente_identificacao` ou outro).
 *
 * Worker bypassa RLS via super_admin (BullMQ não tem tenant context).
 * Filtra por `condominio_id` do payload defensivamente.
 */

export type ExtractLabelPayload = {
  pacote_id: string;
  condominio_id: string;
};

export type ExtractLabelResult = {
  pacote_id: string;
  confianca: number;
  duration_ms: number;
  model: string;
};

export const EXTRACT_LABEL_JOB_NAME = 'extractLabel' as const;

export async function processExtractLabel(
  job: Job<ExtractLabelPayload>,
): Promise<ExtractLabelResult> {
  const log = loggerForJob(job).child({ scope: 'extractLabel' });
  const { pacote_id, condominio_id } = job.data;

  // 1. Carrega pacote + foto principal (bypassa RLS via super_admin context)
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;

    const pacote = await tx.pacote.findFirst({
      where: { id: pacote_id, condominio_id },
      select: { id: true, status: true },
    });
    if (!pacote) {
      throw new Error(`Pacote ${pacote_id} não encontrado em cond ${condominio_id}`);
    }

    const foto = await tx.pacoteFoto.findFirst({
      where: { pacote_id, condominio_id, is_principal: true },
      select: { storage_path: true, mime_type: true, bytes: true },
    });
    if (!foto) {
      throw new Error(`Foto principal não encontrada para pacote ${pacote_id}`);
    }

    return { pacote, foto };
  });

  // 2. Lê foto do storage (fora da transação — I/O externo)
  const fotoData = await storage.get(result.foto.storage_path);

  // 3. Chama Anthropic (fora da transação — pode demorar 2-5s)
  const extraction = await extractLabelFromImage({
    buffer: fotoData.body,
    mimeType: result.foto.mime_type,
  });

  // 4. Atualiza pacote + cria evento em transação
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;

    await tx.pacote.update({
      where: { id: pacote_id },
      data: {
        ia_extracao_raw: extraction.json as Prisma.InputJsonValue,
        ia_confianca: new Prisma.Decimal(extraction.confianca),
        ia_processada_em: new Date(),
      },
    });

    await tx.pacoteEvento.create({
      data: {
        condominio_id,
        pacote_id,
        tipo: 'ia_processou',
        metadata: {
          confianca: extraction.confianca,
          model: extraction.model,
          duration_ms: extraction.durationMs,
          input_tokens: extraction.usage.input_tokens,
          output_tokens: extraction.usage.output_tokens,
          cache_creation_input_tokens: extraction.usage.cache_creation_input_tokens ?? null,
          cache_read_input_tokens: extraction.usage.cache_read_input_tokens ?? null,
        },
      },
    });
  });

  // Log SEM dados pessoais (sugestão @po — privacidade)
  log.info(
    {
      pacote_id,
      confianca: extraction.confianca,
      duration_ms: extraction.durationMs,
      model: extraction.model,
      tokens_input: extraction.usage.input_tokens,
      tokens_output: extraction.usage.output_tokens,
      cache_read: extraction.usage.cache_read_input_tokens,
    },
    'IA extração concluída',
  );

  return {
    pacote_id,
    confianca: extraction.confianca,
    duration_ms: extraction.durationMs,
    model: extraction.model,
  };
}
