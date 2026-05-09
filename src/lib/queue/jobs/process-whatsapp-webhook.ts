import type { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { loggerForJob } from '@/lib/logger';
import type { MetaWebhookValue } from '@/lib/meta-whatsapp/webhook';

/**
 * Job `processWhatsappWebhook` (story 4.4).
 *
 * Recebe um `value` parseado do webhook Meta e atualiza/cria mensagens.
 * Usa client global (bypass RLS) — webhooks são cross-tenant.
 *
 * Idempotência:
 *  - Status updates: lookup por meta_message_id, regride status apenas se não estiver mais avançado.
 *  - Inbound: skip se meta_message_id já existir (Meta pode reentregar).
 */

export type ProcessWebhookPayload = {
  value: MetaWebhookValue;
};

export type ProcessWebhookResult = {
  statuses_processed: number;
  inbound_processed: number;
  inbound_skipped_duplicate: number;
};

export const PROCESS_WHATSAPP_WEBHOOK_JOB_NAME = 'processWhatsappWebhook' as const;

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 99, // failed sempre vence
};

export async function processWhatsappWebhook(
  job: Job<ProcessWebhookPayload>,
): Promise<ProcessWebhookResult> {
  const log = loggerForJob(job).child({ scope: 'webhookMeta' });
  const { value } = job.data;

  let statusesProcessed = 0;
  let inboundProcessed = 0;
  let inboundSkippedDuplicate = 0;

  if (value.statuses?.length) {
    for (const status of value.statuses) {
      const ok = await handleStatusUpdate(status, log);
      if (ok) statusesProcessed++;
    }
  }

  if (value.messages?.length) {
    for (const message of value.messages) {
      const result = await handleInboundMessage(message, value, log);
      if (result === 'created') inboundProcessed++;
      else if (result === 'duplicate') inboundSkippedDuplicate++;
    }
  }

  return {
    statuses_processed: statusesProcessed,
    inbound_processed: inboundProcessed,
    inbound_skipped_duplicate: inboundSkippedDuplicate,
  };
}

async function handleStatusUpdate(
  status: NonNullable<MetaWebhookValue['statuses']>[number],
  log: ReturnType<typeof loggerForJob>,
): Promise<boolean> {
  const existing = await db.whatsAppMessage.findUnique({
    where: { meta_message_id: status.id },
    select: { id: true, status: true },
  });

  if (!existing) {
    log.warn({ meta_message_id: status.id, status: status.status }, 'webhook status: mensagem não encontrada — skip');
    return false;
  }

  // Idempotência — não regride status (delivered → sent é ignorado)
  const currentRank = STATUS_RANK[existing.status] ?? 0;
  const incomingRank = STATUS_RANK[status.status] ?? 0;
  if (incomingRank < currentRank && status.status !== 'failed') {
    return false;
  }

  const data: Prisma.WhatsAppMessageUpdateInput = { status: status.status };
  const ts = new Date(parseInt(status.timestamp, 10) * 1000);
  if (status.status === 'sent') data.sent_at = ts;
  else if (status.status === 'delivered') data.delivered_at = ts;
  else if (status.status === 'read') data.read_at = ts;
  else if (status.status === 'failed') {
    data.failed_at = ts;
    if (status.errors?.[0]) {
      data.failure_reason = `${status.errors[0].code}: ${status.errors[0].title}`.slice(0, 500);
    }
  }

  await db.whatsAppMessage.update({ where: { id: existing.id }, data });
  return true;
}

async function handleInboundMessage(
  message: NonNullable<MetaWebhookValue['messages']>[number],
  value: MetaWebhookValue,
  log: ReturnType<typeof loggerForJob>,
): Promise<'created' | 'duplicate' | 'skipped'> {
  // Idempotência — Meta pode reentregar
  const existing = await db.whatsAppMessage.findUnique({
    where: { meta_message_id: message.id },
    select: { id: true },
  });
  if (existing) return 'duplicate';

  // Lookup morador pelo telefone
  const morador = await db.morador.findFirst({
    where: { telefone: message.from, ativo: true, deleted_at: null },
    select: { id: true, condominio_id: true },
    orderBy: { updated_at: 'desc' },
  });

  if (!morador) {
    log.info({ from: message.from }, 'webhook inbound: telefone não cadastrado');
  }

  // Lookup número WhatsApp pelo phone_number_id do payload
  const whatsappNumber = await db.whatsAppNumber.findFirst({
    where: {
      phone_number_id: value.metadata?.phone_number_id ?? '',
    },
    select: { id: true, display_phone: true },
  });
  if (!whatsappNumber) {
    log.warn(
      { phone_number_id: value.metadata?.phone_number_id },
      'webhook inbound: número WABA não encontrado, skip',
    );
    return 'skipped';
  }

  const condominioId = morador?.condominio_id ?? null;
  if (!condominioId) {
    // Sem condomínio identificado, ainda registramos pra audit. Mas WhatsAppMessage exige condominio_id NOT NULL no schema.
    // Skip — alternativa: criar tabela genérica de inbound. Por ora skip.
    return 'skipped';
  }

  const created = await db.whatsAppMessage.create({
    data: {
      condominio_id: condominioId,
      whatsapp_number_id: whatsappNumber.id,
      meta_message_id: message.id,
      direction: 'inbound',
      status: 'delivered',
      to_phone: whatsappNumber.display_phone,
      from_phone: message.from,
      body_text: message.text?.body ?? null,
      morador_id: morador?.id ?? null,
    },
    select: { id: true },
  });

  // Epic 7: enfileira processamento de palavra-chave se morador identificado
  if (morador?.id) {
    try {
      const { enqueue } = await import('@/lib/queue/queues');
      const { PROCESS_PALAVRA_CHAVE_JOB_NAME } = await import('./process-palavra-chave');
      await enqueue(
        PROCESS_PALAVRA_CHAVE_JOB_NAME,
        { whatsapp_message_id: created.id },
        { jobId: `palavraChave:${created.id}` },
      );
    } catch (err) {
      log.warn({ err, message_id: created.id }, 'Falha ao enfileirar processPalavraChave');
    }
  }

  return 'created';
}
