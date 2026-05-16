import type { Job } from 'bullmq';
import { withSuperAdmin } from '@/lib/db-super-admin';
import { loggerForJob } from '@/lib/logger';

/**
 * Job `expirarPalavrasChave` (Story 7.5).
 *
 * Roda via cron diario (06:00 UTC). Marca CodigoMlPendente com
 * `expira_em < now` e `status=pendente` como `status=expirado`.
 *
 * Batch de ate 500 por execucao pra nao sobrecarregar.
 */

export type ExpirarPalavrasChavePayload = Record<string, never>;

export type ExpirarPalavrasChaveResult = {
  expired: number;
};

export const EXPIRAR_PALAVRAS_CHAVE_JOB_NAME = 'expirarPalavrasChave' as const;

export async function processExpirarPalavrasChave(
  job: Job<ExpirarPalavrasChavePayload>,
): Promise<ExpirarPalavrasChaveResult> {
  const log = loggerForJob(job).child({ scope: 'expirarPalavrasChave' });

  const agora = new Date();

  const result = await withSuperAdmin((tx) =>
    tx.codigoMlPendente.updateMany({
      where: {
        status: 'pendente',
        expira_em: { lt: agora },
      },
      data: {
        status: 'expirado',
      },
    }),
  );

  log.info({ expired: result.count }, 'expirarPalavrasChave: ciclo concluído');
  return { expired: result.count };
}
