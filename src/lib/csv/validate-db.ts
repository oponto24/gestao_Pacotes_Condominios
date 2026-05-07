import { withTenant } from '@/server/db-tenant';
import type { ValidRow } from '@/lib/csv/parse-import';

/**
 * Validação cross-DB para linhas que passaram do parser (story 2.6).
 *
 * Verifica em queries agregadas (anti N+1) se cada linha colide com:
 *   - Unidade existente: (condominio_id, bloco, identificador)
 *   - Telefone existente: (condominio_id, telefone, deleted_at IS NULL)
 *
 * Linhas com colisão NÃO bloqueiam o batch — admin escolhe se prossegue
 * com `okToCreate`. Decisão @po: melhor importar 999/1000 que perder tudo.
 */

export type DbConflictReason = 'UNIDADE_EXISTE' | 'TELEFONE_EXISTE';

export interface ConflictRow extends ValidRow {
  dbConflicts: DbConflictReason[];
}

export interface DbValidationResult {
  okToCreate: ValidRow[];
  conflicting: ConflictRow[];
}

/**
 * Valida `rows` contra o estado atual do DB do tenant.
 * Retorna split entre criáveis e conflitantes.
 */
export async function validateAgainstDb(rows: ValidRow[]): Promise<DbValidationResult> {
  if (rows.length === 0) {
    return { okToCreate: [], conflicting: [] };
  }

  return withTenant(async (tx) => {
    // 1) Buscar unidades existentes que possam colidir.
    //    Bloco NULL no Prisma exige tratamento explícito (lição da 2.3).
    //    Estratégia: 1 query buscando todos identificadores, depois filtra
    //    em memória pela combinação (bloco, identificador) exata.
    const identificadores = [...new Set(rows.map((r) => r.identificador))];

    const unidadesExistentes = await tx.unidade.findMany({
      where: { identificador: { in: identificadores } },
      select: { bloco: true, identificador: true },
    });

    // Mapa de chave normalizada para lookup O(1)
    const unidadeKey = (bloco: string | null, identificador: string) =>
      `${bloco ?? '__null__'}|${identificador}`;
    const unidadesSet = new Set(
      unidadesExistentes.map((u) => unidadeKey(u.bloco, u.identificador)),
    );

    // 2) Buscar telefones existentes (ativos — soft delete NÃO conta).
    const telefones = [...new Set(rows.map((r) => r.morador_telefone))];
    const telefonesExistentes = await tx.morador.findMany({
      where: { telefone: { in: telefones }, deleted_at: null },
      select: { telefone: true },
    });
    const telefonesSet = new Set(telefonesExistentes.map((m) => m.telefone));

    // 3) Particionar
    const okToCreate: ValidRow[] = [];
    const conflicting: ConflictRow[] = [];

    for (const row of rows) {
      const conflicts: DbConflictReason[] = [];

      if (unidadesSet.has(unidadeKey(row.bloco ?? null, row.identificador))) {
        conflicts.push('UNIDADE_EXISTE');
      }

      if (telefonesSet.has(row.morador_telefone)) {
        conflicts.push('TELEFONE_EXISTE');
      }

      if (conflicts.length > 0) {
        conflicting.push({ ...row, dbConflicts: conflicts });
      } else {
        okToCreate.push(row);
      }
    }

    return { okToCreate, conflicting };
  });
}

/**
 * Versão não-tenant (recebe `tx` externo) — usada nos tests integration
 * que setam contexto manualmente.
 */
export async function validateAgainstDbWithTx(
  tx: Parameters<Parameters<typeof withTenant>[0]>[0],
  rows: ValidRow[],
): Promise<DbValidationResult> {
  if (rows.length === 0) {
    return { okToCreate: [], conflicting: [] };
  }

  const identificadores = [...new Set(rows.map((r) => r.identificador))];

  const unidadesExistentes = await tx.unidade.findMany({
    where: { identificador: { in: identificadores } },
    select: { bloco: true, identificador: true },
  });

  const unidadeKey = (bloco: string | null, identificador: string) =>
    `${bloco ?? '__null__'}|${identificador}`;
  const unidadesSet = new Set(
    unidadesExistentes.map((u) => unidadeKey(u.bloco, u.identificador)),
  );

  const telefones = [...new Set(rows.map((r) => r.morador_telefone))];
  const telefonesExistentes = await tx.morador.findMany({
    where: { telefone: { in: telefones }, deleted_at: null },
    select: { telefone: true },
  });
  const telefonesSet = new Set(telefonesExistentes.map((m) => m.telefone));

  const okToCreate: ValidRow[] = [];
  const conflicting: ConflictRow[] = [];

  for (const row of rows) {
    const conflicts: DbConflictReason[] = [];
    if (unidadesSet.has(unidadeKey(row.bloco ?? null, row.identificador))) {
      conflicts.push('UNIDADE_EXISTE');
    }
    if (telefonesSet.has(row.morador_telefone)) {
      conflicts.push('TELEFONE_EXISTE');
    }
    if (conflicts.length > 0) {
      conflicting.push({ ...row, dbConflicts: conflicts });
    } else {
      okToCreate.push(row);
    }
  }

  return { okToCreate, conflicting };
}
