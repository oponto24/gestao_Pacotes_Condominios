import type { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { storage } from '@/lib/storage';
import { extractLabelFromImage } from '@/lib/ai/extract-label';
import {
  matchUnidadeMorador,
  type MatchResult,
} from '@/lib/matching/match-unidade-morador';
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
  match: MatchResult;
};

export const EXTRACT_LABEL_JOB_NAME = 'extractLabel' as const;

export async function processExtractLabel(
  job: Job<ExtractLabelPayload>,
): Promise<ExtractLabelResult> {
  const log = loggerForJob(job).child({ scope: 'extractLabel' });
  const { pacote_id, condominio_id } = job.data;

  // 1. Carrega pacote + foto + condominio + unidades + moradores (bypassa RLS)
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;

    const pacote = await tx.pacote.findFirst({
      where: { id: pacote_id, condominio_id },
      select: { id: true, status: true, codigo_rastreio: true },
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

    const condominio = await tx.condominio.findUniqueOrThrow({
      where: { id: condominio_id },
      select: { cep: true },
    });

    const unidades = await tx.unidade.findMany({
      where: { condominio_id, ativo: true },
      select: { id: true, identificador: true, bloco: true },
    });

    const moradores = await tx.morador.findMany({
      where: { condominio_id, ativo: true, deleted_at: null },
      select: {
        id: true,
        unidade_id: true,
        nome: true,
        nome_normalizado: true,
        is_principal: true,
      },
    });

    return { pacote, foto, condominio, unidades, moradores };
  });

  // 2. Lê foto do storage (fora da transação — I/O externo)
  const fotoData = await storage.get(result.foto.storage_path);

  // 3. Chama Anthropic (fora da transação — pode demorar 2-5s)
  const extraction = await extractLabelFromImage({
    buffer: fotoData.body,
    mimeType: result.foto.mime_type,
  });

  // Narrow do union (extraction.json é success ou fallback de erro)
  const iaJson = extraction.json as Record<string, unknown>;
  const iaNome = (iaJson.nome_destinatario as string | null | undefined) ?? null;
  const iaEndereco = (iaJson.endereco as string | null | undefined) ?? null;
  const iaBairro = (iaJson.bairro as string | null | undefined) ?? null;
  const iaCep = (iaJson.cep as string | null | undefined) ?? null;
  const iaComplemento = (iaJson.complemento as string | null | undefined) ?? null;
  const iaRemetente = (iaJson.remetente as string | null | undefined) ?? null;
  const iaCodigoRastreio =
    (iaJson.codigo_rastreio as string | null | undefined) ?? null;

  // 4. Roda matching IA → unidade/morador (story 3.7) — função pura, custo zero
  const match = matchUnidadeMorador({
    condominio_cep: result.condominio.cep,
    ia: {
      nome_destinatario: iaNome,
      cep: iaCep,
      complemento: iaComplemento,
    },
    unidades: result.unidades,
    moradores: result.moradores,
  });

  // 5. Atualiza pacote + cria evento em transação
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;

    const updateData: Prisma.PacoteUpdateInput = {
      ia_extracao_raw: extraction.json as Prisma.InputJsonValue,
      ia_confianca: new Prisma.Decimal(extraction.confianca),
      ia_processada_em: new Date(),
      // Campos textuais extraídos (servem pra UI da 3.8 e auditoria)
      nome_destinatario_etiqueta: iaNome,
      endereco_etiqueta: iaEndereco,
      bairro_etiqueta: iaBairro,
      cep_etiqueta: iaCep,
      complemento_etiqueta: iaComplemento,
      remetente: iaRemetente,
    };

    // Preenche codigo_rastreio se IA extraiu e o porteiro não tinha digitado.
    // Trim + dedupe pra evitar overwrite se já tem valor manual.
    const codigoExtraidoLimpo = iaCodigoRastreio?.trim() || null;
    if (codigoExtraidoLimpo && !result.pacote.codigo_rastreio) {
      updateData.codigo_rastreio = codigoExtraidoLimpo;
    }

    if (match.kind === 'matched') {
      updateData.unidade = { connect: { id: match.unidade_id } };
      updateData.destinatario = { connect: { id: match.destinatario_id } };
      updateData.destinatario_resolvido_via = match.resolvido_via;
      // Status permanece rascunho — story 3.8 confirma
    } else {
      // pending: muda para pendente_identificacao (FR-021)
      updateData.status = 'pendente_identificacao';
      if (match.unidade_id) {
        updateData.unidade = { connect: { id: match.unidade_id } };
      }
    }

    await tx.pacote.update({ where: { id: pacote_id }, data: updateData });

    await tx.pacoteEvento.create({
      data: {
        condominio_id,
        pacote_id,
        tipo: 'ia_processou',
        metadata: {
          confianca: extraction.confianca,
          provider: extraction.provider,
          model: extraction.model,
          duration_ms: extraction.durationMs,
          input_tokens: extraction.usage.input_tokens,
          output_tokens: extraction.usage.output_tokens,
          cache_creation_input_tokens: extraction.usage.cache_creation_input_tokens ?? null,
          cache_read_input_tokens: extraction.usage.cache_read_input_tokens ?? null,
          matching: {
            kind: match.kind,
            unidade_id: match.unidade_id,
            destinatario_id: match.kind === 'matched' ? match.destinatario_id : null,
            resolvido_via: match.kind === 'matched' ? match.resolvido_via : null,
            reason: match.kind === 'pending' ? match.reason : null,
            cep_diverge: match.flags.cep_diverge,
            complemento_extraido: match.flags.complemento_extraido
              ? {
                  apto: match.flags.complemento_extraido.apto,
                  bloco: match.flags.complemento_extraido.bloco,
                }
              : null,
          },
        } as Prisma.InputJsonValue,
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
      match_kind: match.kind,
      match_reason: match.kind === 'pending' ? match.reason : match.resolvido_via,
    },
    'IA extração + matching concluídos',
  );

  return {
    pacote_id,
    confianca: extraction.confianca,
    duration_ms: extraction.durationMs,
    model: extraction.model,
    match,
  };
}
