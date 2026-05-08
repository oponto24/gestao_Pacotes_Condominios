import type { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { ensureQrForPacote } from '@/lib/qr';
import { MetaApiError, sendTemplate } from '@/lib/meta-whatsapp';
import { chooseRecipient } from '@/lib/whatsapp/recipient';
import { loggerForJob } from '@/lib/logger';

/**
 * Job `sendWhatsApp` (story 4.3).
 *
 * Enfileirado quando porteiro organiza um pacote (story 3.9 muda status pra
 * `aguardando_retirada`). Worker:
 *  1. Carrega pacote + WhatsAppNumber compartilhado
 *  2. Determina destinatário (lógica simplificada — story 4.5 substitui)
 *  3. Garante QR Code via 4.2
 *  4. Cria WhatsAppMessage em `pending`
 *  5. Chama Meta sendTemplate (4.1)
 *  6. Atualiza com wamid + `sent`
 *
 * Retry: BullMQ aplica backoff exponencial (configurado no enqueue).
 * Erros não-retriable (`MetaApiError.retriable === false`) marcam mensagem
 * `failed` sem throw — retry só faz sentido pra erros transitórios.
 */

export type SendWhatsAppPayload = {
  pacote_id: string;
  condominio_id: string;
};

export type SendWhatsAppResult = {
  pacote_id: string;
  whatsapp_message_id: string;
  status: 'sent' | 'failed';
  wamid?: string;
  failure_reason?: string;
};

export const SEND_WHATSAPP_JOB_NAME = 'sendWhatsApp' as const;

/** Template aprovado pela Meta (story setup-meta-whatsapp Etapa 5). */
const TEMPLATE_NAME = process.env.META_TEMPLATE_NAME ?? 'pacote_chegou';
const TEMPLATE_LANGUAGE = process.env.META_TEMPLATE_LANG ?? 'pt_BR';

export async function processSendWhatsApp(
  job: Job<SendWhatsAppPayload>,
): Promise<SendWhatsAppResult> {
  const log = loggerForJob(job).child({ scope: 'sendWhatsApp' });
  const { pacote_id, condominio_id } = job.data;

  // 1. Carrega contexto: pacote + condomínio + WABA compartilhado + destinatário
  const ctx = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;

    const pacote = await tx.pacote.findFirst({
      where: { id: pacote_id, condominio_id },
      select: {
        id: true,
        condominio_id: true,
        unidade_id: true,
        condominio: { select: { nome: true } },
      },
    });

    if (!pacote) {
      throw new Error(`Pacote ${pacote_id} não encontrado em cond ${condominio_id}`);
    }
    if (!pacote.unidade_id) {
      throw new Error(`Pacote ${pacote_id} sem unidade — não pode enviar WhatsApp`);
    }

    const whatsappNumber = await tx.whatsAppNumber.findFirst({
      where: { condominio_id: null, ativo: true },
      select: { id: true, display_phone: true },
    });
    if (!whatsappNumber) {
      throw new Error(
        'WhatsAppNumber compartilhado não configurado (condominio_id IS NULL, ativo=true)',
      );
    }

    return { pacote, whatsappNumber };
  });

  // 2. Determina destinatário (story 4.5 — nome → principal → adicional)
  const recipient = await chooseRecipient(pacote_id);
  if (!recipient) {
    log.warn({ pacote_id }, 'sendWhatsApp: sem destinatário com telefone');
    const message = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.whatsAppMessage.create({
        data: {
          condominio_id,
          whatsapp_number_id: ctx.whatsappNumber.id,
          direction: 'outbound',
          status: 'failed',
          to_phone: '',
          from_phone: ctx.whatsappNumber.display_phone,
          template_name: TEMPLATE_NAME,
          pacote_id,
          failure_reason: 'sem_destinatario_telefone',
          failed_at: new Date(),
        },
        select: { id: true },
      });
    });
    return {
      pacote_id,
      whatsapp_message_id: message.id,
      status: 'failed',
      failure_reason: 'sem_destinatario_telefone',
    };
  }

  // 3. Gera/recupera QR Code
  const qr = await ensureQrForPacote(pacote_id);

  // 4. Cria WhatsAppMessage em pending
  const messageRow = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    return tx.whatsAppMessage.create({
      data: {
        condominio_id,
        whatsapp_number_id: ctx.whatsappNumber.id,
        direction: 'outbound',
        status: 'pending',
        to_phone: recipient.telefone,
        from_phone: ctx.whatsappNumber.display_phone,
        template_name: TEMPLATE_NAME,
        template_params: {
          body: [recipient.nome, ctx.pacote.condominio.nome],
          header: { type: 'image', url: qr.publicUrl },
          matched_by: recipient.matched_by,
        } as Prisma.InputJsonValue,
        pacote_id,
        morador_id: recipient.morador_id,
      },
      select: { id: true, retry_count: true },
    });
  });

  // Audit: matched_by já registrado em template_params JSON da mensagem.
  // Evento dedicado em PacoteEvento exigiria nova entrada no enum
  // PacoteEventoTipo (atualmente: criado, ia_processou, confirmado, notificado,
  // notificacao_falhou, retirado, cancelado, pendencia_resolvida,
  // reenvio_notificacao). Dispensável no MVP — débito menor.

  // 5. Chama Meta sendTemplate
  try {
    const sendResult = await sendTemplate({
      to: recipient.telefone,
      templateName: TEMPLATE_NAME,
      languageCode: TEMPLATE_LANGUAGE,
      headerImageUrl: qr.publicUrl,
      bodyParams: [recipient.nome, ctx.pacote.condominio.nome],
    });

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      await tx.whatsAppMessage.update({
        where: { id: messageRow.id },
        data: {
          meta_message_id: sendResult.wamid,
          status: 'sent',
          sent_at: new Date(),
        },
      });
    });

    log.info({ pacote_id, wamid: sendResult.wamid, mock: sendResult.mock }, 'sendWhatsApp: enviado');
    return {
      pacote_id,
      whatsapp_message_id: messageRow.id,
      status: 'sent',
      wamid: sendResult.wamid,
    };
  } catch (err) {
    const failureReason = err instanceof MetaApiError ? `${err.code}: ${err.userFacing}` : (err as Error).message;
    const retriable = err instanceof MetaApiError ? err.retriable : true;

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      await tx.whatsAppMessage.update({
        where: { id: messageRow.id },
        data: {
          status: 'failed',
          failure_reason: failureReason.slice(0, 500),
          failed_at: new Date(),
          retry_count: { increment: 1 },
        },
      });
    });

    if (retriable) {
      log.warn({ pacote_id, err: failureReason }, 'sendWhatsApp: erro retriable, throw');
      throw err;
    }

    log.error({ pacote_id, err: failureReason }, 'sendWhatsApp: erro não-retriable, sem throw');
    return {
      pacote_id,
      whatsapp_message_id: messageRow.id,
      status: 'failed',
      failure_reason: failureReason,
    };
  }
}

