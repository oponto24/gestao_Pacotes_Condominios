import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getTenantContext, type TenantContext } from '@/server/middleware/tenant';

/**
 * Cliente Prisma transacional dentro de um TransactionClient.
 * É o tipo que o callback de `withTenant`/`withTenantContext` recebe.
 */
export type TenantTx = Omit<Prisma.TransactionClient, '$connect' | '$disconnect'>;

/**
 * Wrappa uma operação dentro de uma transação Prisma com `SET LOCAL`
 * apropriado para o contexto:
 *   - `tenant`: SET LOCAL app.current_condominio = '<uuid>'
 *   - `super_admin`: SET LOCAL app.is_super_admin = 'true'
 *
 * IMPORTANTE: `SET LOCAL` exige transação ativa. Fora de transação é
 * silenciosamente ignorado, o que vazaria dados em produção. Por isso
 * forçamos `db.$transaction` aqui.
 *
 * Uso:
 *   const unidades = await withTenantContext(ctx, async (tx) => {
 *     return tx.unidade.findMany();
 *   });
 */
// Validação defensiva: SET LOCAL não aceita placeholders ($1) do Postgres,
// então precisamos interpolar string. Garantimos formato UUID antes para
// evitar SQL injection mesmo que condominioId venha de fonte não confiável.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withTenantContext<T>(
  ctx: TenantContext,
  callback: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    if (ctx.kind === 'super_admin') {
      // Limpar tenant id (caso venha "vazado" de query anterior na mesma conexão pool)
      await tx.$executeRawUnsafe(`SET LOCAL app.current_condominio = ''`);
      await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = 'true'`);
    } else {
      if (!UUID_RE.test(ctx.condominioId)) {
        throw new Error(`condominioId inválido (não é UUID): ${ctx.condominioId}`);
      }
      await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = ''`);
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_condominio = '${ctx.condominioId}'`,
      );
    }

    return callback(tx);
  });
}

/**
 * Atalho que resolve o contexto via getTenantContext (cached) e wrappa
 * a operação. Usar em route handlers / server actions onde a chamada
 * é feita "no contexto do request".
 *
 * Lança erros tenant (Unauthorized, PendingProvisioning, NoCondominio)
 * que devem ser tratados pelo caller (rota).
 */
export async function withTenant<T>(callback: (tx: TenantTx) => Promise<T>): Promise<T> {
  const ctx = await getTenantContext();
  return withTenantContext(ctx, callback);
}
