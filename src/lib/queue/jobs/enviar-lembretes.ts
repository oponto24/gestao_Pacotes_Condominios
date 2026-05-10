import type { Job } from 'bullmq';
import { withSuperAdmin } from '@/lib/db-super-admin';
import { ensureQrForPacote } from '@/lib/qr';
import { sendTemplate, MetaApiError } from '@/lib/meta-whatsapp';
import { chooseRecipient } from '@/lib/whatsapp/recipient';
import { loggerForJob } from '@/lib/logger';

/**
 * Job `enviarLembretes` (decisão produto 2026-05-09).
 *
 * Roda via cron a cada 1h (configurar no scheduler externo). Busca pacotes
 * em `aguardando_retirada` com `proximo_lembrete_em <= now` e `lembretes_pausados=false`.
 * Pra cada um, dispara template `pacote_chegou` (QR Code) novamente e
 * agenda próximo lembrete pra +24h.
 *
 * Pausa automática: handler do webhook (story 4.4) marca pacote como
 * `lembretes_pausados=true` quando morador responde qualquer mensagem inbound.
 */

export type EnviarLembretesPayload = Record<string, never>;

export type EnviarLembretesResult = {
  scanned: number;
  sent: number;
  errors: number;
};

export const ENVIAR_LEMBRETES_JOB_NAME = 'enviarLembretes' as const;

const TEMPLATE_NAME = process.env.META_TEMPLATE_NAME ?? 'pacote_chegou';
const TEMPLATE_LANG = process.env.META_TEMPLATE_LANG ?? 'pt_BR';
const PROXIMO_LEMBRETE_HORAS = 24;

export async function processEnviarLembretes(
  job: Job<EnviarLembretesPayload>,
): Promise<EnviarLembretesResult> {
  const log = loggerForJob(job).child({ scope: 'enviarLembretes' });

  const agora = new Date();
  const proximo = new Date(agora.getTime() + PROXIMO_LEMBRETE_HORAS * 60 * 60 * 1000);

  // Busca cross-tenant — bypass RLS via SET LOCAL is_super_admin
  const pacotes = await withSuperAdmin((tx) =>
    tx.pacote.findMany({
      where: {
        status: 'aguardando_retirada',
        lembretes_pausados: false,
        proximo_lembrete_em: { lte: agora },
        qr_consumido_em: null,
      },
      select: {
        id: true,
        condominio_id: true,
        condominio: { select: { nome: true } },
      },
      take: 100, // limite por execução (cron roda a cada 1h, evita avalanche)
    }),
  );

  let sent = 0;
  let errors = 0;

  for (const pacote of pacotes) {
    try {
      const recipient = await chooseRecipient(pacote.id);
      if (!recipient) {
        log.warn({ pacote_id: pacote.id }, 'lembrete: sem destinatário, skip');
        await withSuperAdmin((tx) =>
          tx.pacote.update({
            where: { id: pacote.id },
            data: {
              lembretes_pausados: true,
              lembretes_pausados_em: agora,
              lembretes_pausados_motivo: 'sem_destinatario',
            },
          }),
        );
        continue;
      }

      const qr = await ensureQrForPacote(pacote.id);

      await sendTemplate({
        to: recipient.telefone,
        templateName: TEMPLATE_NAME,
        languageCode: TEMPLATE_LANG,
        headerImageUrl: qr.publicUrl,
        bodyParams: [recipient.nome, pacote.condominio.nome],
      });

      await withSuperAdmin((tx) =>
        tx.pacote.update({
          where: { id: pacote.id },
          data: {
            ultimo_lembrete_em: agora,
            proximo_lembrete_em: proximo,
          },
        }),
      );

      sent++;
    } catch (err) {
      errors++;
      const reason = err instanceof MetaApiError ? `${err.code}: ${err.userFacing}` : (err as Error).message;
      log.error({ pacote_id: pacote.id, err: reason }, 'lembrete: falha no envio');
      // Em caso de erro Meta, agendar pra +1h e tentar de novo (não pausar)
      await withSuperAdmin((tx) =>
        tx.pacote.update({
          where: { id: pacote.id },
          data: { proximo_lembrete_em: new Date(agora.getTime() + 60 * 60 * 1000) },
        }),
      );
    }
  }

  log.info({ scanned: pacotes.length, sent, errors }, 'enviarLembretes: ciclo concluído');
  return { scanned: pacotes.length, sent, errors };
}
