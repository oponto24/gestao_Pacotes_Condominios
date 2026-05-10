/**
 * Quotas por condomínio (story quotas-001).
 *
 * Valida no create de unidade, morador, pacote. NULL no campo significa ilimitado
 * (super-admin override). Caller é responsável por:
 *   - Estar dentro de transação tenant-scoped (ou wrappar withTenant/withSuperAdmin)
 *   - Chamar ANTES de criar (assertion lança QuotaExceededError em caso de excesso)
 */

import type { Prisma } from '@prisma/client';
import { ValidationError } from '@/server/errors';

export class QuotaExceededError extends ValidationError {
  constructor(resource: string, used: number, limit: number) {
    super(
      `Limite atingido: ${resource} (${used}/${limit}). Contate o suporte pra aumentar o plano.`,
    );
  }
}

type Tx = Prisma.TransactionClient;

async function getCaps(tx: Tx, condominioId: string) {
  const cond = await tx.condominio.findFirst({
    where: { id: condominioId },
    select: { max_unidades: true, max_moradores: true, max_pacotes_30d: true },
  });
  if (!cond) throw new ValidationError('Condomínio não encontrado');
  return cond;
}

export async function assertUnidadeQuota(tx: Tx, condominioId: string): Promise<void> {
  const cond = await getCaps(tx, condominioId);
  if (cond.max_unidades === null) return; // ilimitado
  // Unidade não tem soft-delete (não tem deleted_at). Filtra ativas.
  const used = await tx.unidade.count({
    where: { condominio_id: condominioId, ativo: true },
  });
  if (used >= cond.max_unidades) {
    throw new QuotaExceededError('unidades', used, cond.max_unidades);
  }
}

export async function assertMoradorQuota(tx: Tx, condominioId: string): Promise<void> {
  const cond = await getCaps(tx, condominioId);
  if (cond.max_moradores === null) return;
  const used = await tx.morador.count({
    where: { condominio_id: condominioId, deleted_at: null },
  });
  if (used >= cond.max_moradores) {
    throw new QuotaExceededError('moradores', used, cond.max_moradores);
  }
}

export async function assertPacote30dQuota(tx: Tx, condominioId: string): Promise<void> {
  const cond = await getCaps(tx, condominioId);
  if (cond.max_pacotes_30d === null) return;
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const used = await tx.pacote.count({
    where: { condominio_id: condominioId, created_at: { gte: desde } },
  });
  if (used >= cond.max_pacotes_30d) {
    throw new QuotaExceededError('pacotes nos últimos 30 dias', used, cond.max_pacotes_30d);
  }
}
