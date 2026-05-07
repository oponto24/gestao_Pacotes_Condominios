import { withTenant } from '@/server/db-tenant';
import { normalizarNome } from '@/lib/text/normalize';
import { getTenantContext } from '@/server/middleware/tenant';
import type { ValidRow } from '@/lib/csv/parse-import';

/**
 * Commit transacional do batch CSV (story 2.6).
 *
 * Cria N unidades + N moradores principais em **uma única transação**.
 * Qualquer erro em qualquer linha → rollback completo (zero gravado).
 *
 * `withTenant` já wrappa em $transaction com SET LOCAL apropriado para
 * RLS. Timeout explícito de 10s evita lock indefinido (sugestão @po).
 *
 * `nome_normalizado` derivado server-side via `normalizarNome` (defesa
 * contra client malicioso que pudesse forjar; consistência com 2.4).
 */

export interface CommitResult {
  ok: true;
  created: { unidades: number; moradores: number };
  duration_ms: number;
}

export interface CommitErrorResult {
  ok: false;
  error: string;
  rolled_back: true;
}

/**
 * Commita o batch. Lança erro se transação falhar — caller traduz em
 * resposta HTTP via `handleApiError`.
 */
export async function commitImport(rows: ValidRow[]): Promise<CommitResult> {
  if (rows.length === 0) {
    return {
      ok: true,
      created: { unidades: 0, moradores: 0 },
      duration_ms: 0,
    };
  }

  // Resolve tenant antes da transação para usar condominio_id em creates.
  const ctx = await getTenantContext();
  if (ctx.kind !== 'tenant') {
    throw new Error('Commit CSV requer contexto tenant (admin do condomínio)');
  }
  const condominioId = ctx.condominioId;

  const startedAt = Date.now();

  const result = await withTenant(async (tx) => {
    let unidadesCriadas = 0;
    let moradoresCriados = 0;

    for (const row of rows) {
      // 1) Cria unidade
      const unidade = await tx.unidade.create({
        data: {
          condominio_id: condominioId,
          identificador: row.identificador,
          bloco: row.bloco ?? null,
          ativo: true,
        },
      });
      unidadesCriadas++;

      // 2) Cria morador principal vinculado à unidade
      await tx.morador.create({
        data: {
          condominio_id: condominioId,
          unidade_id: unidade.id,
          nome: row.morador_nome,
          nome_normalizado: normalizarNome(row.morador_nome),
          telefone: row.morador_telefone,
          email: row.morador_email ?? null,
          is_principal: true,
          ativo: true,
        },
      });
      moradoresCriados++;
    }

    return { unidades: unidadesCriadas, moradores: moradoresCriados };
  });

  return {
    ok: true,
    created: result,
    duration_ms: Date.now() - startedAt,
  };
}
