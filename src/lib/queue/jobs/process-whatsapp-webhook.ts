import type { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { withSuperAdmin } from '@/lib/db-super-admin';
import { loggerForJob } from '@/lib/logger';
import { normalizePhone } from '@/lib/validators/_shared';
import type { MetaWebhookValue } from '@/lib/meta-whatsapp/webhook';
import { processWebhookPayloadSchema } from './schemas';

/**
 * Job `processWhatsappWebhook` (story 4.4).
 *
 * Recebe um `value` parseado do webhook Meta e atualiza/cria mensagens.
 * Bypassa RLS via `withSuperAdmin` — webhooks são cross-tenant e o lookup
 * de morador atravessa tenants pelo telefone E.164.
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
  const validPayload = processWebhookPayloadSchema.safeParse(job.data);
  if (!validPayload.success) {
    log.error({ errors: validPayload.error.flatten() }, 'payload inválido — descartando job');
    return { statuses_processed: 0, inbound_processed: 0, inbound_skipped_duplicate: 0 };
  }
  const { value } = validPayload.data as unknown as ProcessWebhookPayload;

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
  return withSuperAdmin(async (tx) => {
    const existing = await tx.whatsAppMessage.findUnique({
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

    await tx.whatsAppMessage.update({ where: { id: existing.id }, data });
    return true;
  });
}

async function handleInboundMessage(
  message: NonNullable<MetaWebhookValue['messages']>[number],
  value: MetaWebhookValue,
  log: ReturnType<typeof loggerForJob>,
): Promise<'created' | 'duplicate' | 'skipped'> {
  // Meta envia `from` em formato sem '+' (ex: "5511988108784").
  // Moradores estão salvos em E.164 ("+5511988108784") — normalizamos pra casar.
  const fromNormalized = normalizePhone(message.from);

  const lookup = await withSuperAdmin(async (tx) => {
    const existing = await tx.whatsAppMessage.findUnique({
      where: { meta_message_id: message.id },
      select: { id: true },
    });
    if (existing) return { kind: 'duplicate' as const };

    const morador = await tx.morador.findFirst({
      where: { telefone: fromNormalized, ativo: true, deleted_at: null },
      select: { id: true, condominio_id: true },
      orderBy: { updated_at: 'desc' },
    });

    const whatsappNumber = await tx.whatsAppNumber.findFirst({
      where: {
        phone_number_id: value.metadata?.phone_number_id ?? '',
      },
      select: { id: true, display_phone: true },
    });

    return { kind: 'fresh' as const, morador, whatsappNumber };
  });

  if (lookup.kind === 'duplicate') return 'duplicate';

  const { morador, whatsappNumber } = lookup;

  if (!morador) {
    log.info({ from: fromNormalized }, 'webhook inbound: telefone não cadastrado');
  }

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

  const created = await withSuperAdmin((tx) =>
    tx.whatsAppMessage.create({
      data: {
        condominio_id: condominioId,
        whatsapp_number_id: whatsappNumber.id,
        meta_message_id: message.id,
        direction: 'inbound',
        status: 'delivered',
        to_phone: whatsappNumber.display_phone,
        from_phone: fromNormalized,
        body_text: message.text?.body ?? null,
        morador_id: morador?.id ?? null,
      },
      select: { id: true },
    }),
  );

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

    // Decisão produto 2026-05-09: pausar lembretes 24h dos pacotes pendentes
    // do morador. Admin do condomínio reagenda manualmente quando apropriado.
    try {
      const result = await withSuperAdmin((tx) =>
        tx.pacote.updateMany({
          where: {
            condominio_id: condominioId,
            status: 'aguardando_retirada',
            destinatario_id: morador.id,
            lembretes_pausados: false,
          },
          data: {
            lembretes_pausados: true,
            lembretes_pausados_em: new Date(),
            lembretes_pausados_motivo: 'morador_respondeu_whatsapp',
          },
        }),
      );
      if (result.count > 0) {
        log.info(
          { morador_id: morador.id, pacotes_pausados: result.count },
          'lembretes pausados — morador respondeu WhatsApp',
        );
      }
    } catch (err) {
      log.warn({ err, morador_id: morador.id }, 'Falha ao pausar lembretes');
    }
  }

  return 'created';
}
