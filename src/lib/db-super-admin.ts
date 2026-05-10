import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

type TxClient = Prisma.TransactionClient;

/**
 * Executa `fn` dentro de uma transação com `app.is_super_admin = 'true'`,
 * permitindo bypass de RLS. Uso obrigatório em workers BullMQ e jobs cron,
 * onde não há request HTTP pra setar tenant context (`app.condominio_id`).
 *
 * Caller continua responsável por filtrar `condominio_id` manualmente quando
 * relevante — bypass NÃO substitui isolamento lógico.
 */
export function withSuperAdmin<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    return fn(tx);
  });
}
