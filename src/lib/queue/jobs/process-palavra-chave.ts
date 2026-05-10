import type { Job } from 'bullmq';
import { withSuperAdmin } from '@/lib/db-super-admin';
import { sendTemplate } from '@/lib/meta-whatsapp';
import { parsePalavraChave } from '@/lib/whatsapp/parse-palavra-chave';
import { loggerForJob } from '@/lib/logger';

/**
 * Job `processPalavraChave` (Epic 7).
 *
 * Disparado pelo handler do webhook (4.4) quando uma WhatsAppMessage inbound
 * é registrada com morador_id (telefone cadastrado). Job:
 *   1. Carrega WhatsAppMessage inbound
 *   2. Tenta extrair palavra-chave via regex
 *   3. Se extraiu: persiste em codigo_ml_pendente + reply confirmando
 *   4. Se não extraiu: ignora silenciosamente (mensagem fica registrada pra audit)
 *
 * Mensagens de morador não cadastrado (morador_id=null) não chegam neste job —
 * o webhook só enfileira quando há morador conhecido. Resposta "morador nao
 * cadastrado" é tratada separadamente quando chegar a story.
 */

export type ProcessPalavraChavePayload = {
  whatsapp_message_id: string;
};

export const PROCESS_PALAVRA_CHAVE_JOB_NAME = 'processPalavraChave' as const;

const TEMPLATE_NAME = 'palavra_chave_recebida';
const TEMPLATE_LANG = 'pt_BR';
const EXPIRACAO_DIAS = 30;

export async function processPalavraChave(
  job: Job<ProcessPalavraChavePayload>,
): Promise<{ ok: true; codigo_id?: string; skipped_reason?: string }> {
  const log = loggerForJob(job).child({ scope: 'palavraChave' });

  const message = await withSuperAdmin((tx) =>
    tx.whatsAppMessage.findUnique({
      where: { id: job.data.whatsapp_message_id },
      select: {
        id: true,
        direction: true,
        condominio_id: true,
        morador_id: true,
        from_phone: true,
        body_text: true,
      },
    }),
  );

  if (!message) return { ok: true, skipped_reason: 'message_not_found' };
  if (message.direction !== 'inbound') {
    return { ok: true, skipped_reason: 'not_inbound' };
  }
  if (!message.morador_id) {
    return { ok: true, skipped_reason: 'no_morador' };
  }
  if (!message.body_text) {
    return { ok: true, skipped_reason: 'no_body' };
  }

  const parsed = parsePalavraChave(message.body_text);
  if (!parsed) {
    log.info({ message_id: message.id }, 'palavraChave: regex não casou — ignora');
    return { ok: true, skipped_reason: 'no_match' };
  }

  // Idempotência: se já existe palavra-chave pendente igual pra esse morador,
  // skipa (Meta pode reentregar inbound mesmo com nosso dedupe por meta_message_id).
  // Lookup + create na mesma transação pra evitar race entre 2 entregas paralelas.
  const expira = new Date(Date.now() + EXPIRACAO_DIAS * 24 * 60 * 60 * 1000);

  const result = await withSuperAdmin(async (tx) => {
    const existing = await tx.codigoMlPendente.findFirst({
      where: {
        morador_id: message.morador_id!,
        codigo: parsed.codigo,
        status: 'pendente',
      },
      select: { id: true },
    });
    if (existing) {
      return { kind: 'duplicate' as const, id: existing.id };
    }
    const created = await tx.codigoMlPendente.create({
      data: {
        condominio_id: message.condominio_id,
        morador_id: message.morador_id!,
        codigo: parsed.codigo,
        descricao: parsed.descricao,
        mensagem_origem_id: message.id,
        status: 'pendente',
        expira_em: expira,
      },
      select: { id: true },
    });
    return { kind: 'created' as const, id: created.id };
  });

  if (result.kind === 'duplicate') {
    return { ok: true, codigo_id: result.id, skipped_reason: 'duplicate_pendente' };
  }
  const created = { id: result.id };

  log.info(
    { codigo_id: created.id, codigo: parsed.codigo, morador_id: message.morador_id },
    'palavraChave: persistida',
  );

  // Reply via Meta template (silenciosamente falha se template não aprovado ainda)
  try {
    await sendTemplate({
      to: message.from_phone,
      templateName: TEMPLATE_NAME,
      languageCode: TEMPLATE_LANG,
      bodyParams: [parsed.codigo],
    });
  } catch (err) {
    log.warn(
      { codigo_id: created.id, err: err instanceof Error ? err.message : err },
      'palavraChave: reply Meta falhou (template pode não estar aprovado)',
    );
  }

  return { ok: true, codigo_id: created.id };
}
