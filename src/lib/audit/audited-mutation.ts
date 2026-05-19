/**
 * Audited mutation helpers (story 12.4).
 *
 * Wraps common CRUD operations to automatically capture before/after state
 * and write to audit_log with diff metadata.
 *
 * Diffs are stored in the existing `metadata` JSON field:
 *   { before: { field: oldVal }, after: { field: newVal }, changed: ['field'] }
 */

import { writeAuditLog } from './write-log';

interface AuditContext {
  userId: string;
  condominioId?: string | null;
  request?: Request | null;
}

/**
 * Compute shallow diff between two objects. Returns only fields that changed.
 */
export function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown>; changed: string[] } {
  const changed: string[] = [];
  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    // Skip internal fields
    if (key === 'updated_at' || key === 'created_at') continue;

    const bVal = before[key];
    const aVal = after[key];

    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      changed.push(key);
      beforeDiff[key] = bVal;
      afterDiff[key] = aVal;
    }
  }

  return { before: beforeDiff, after: afterDiff, changed };
}

/**
 * Audit a create operation. Logs the created entity's snapshot.
 */
export async function auditCreate(
  ctx: AuditContext,
  entidadeTipo: string,
  created: Record<string, unknown>,
): Promise<void> {
  await writeAuditLog({
    userId: ctx.userId,
    condominioId: ctx.condominioId,
    acao: `${entidadeTipo}_created`,
    entidadeTipo,
    entidadeId: (created.id as string) ?? null,
    metadata: { after: created },
    request: ctx.request,
  });
}

/**
 * Audit an update operation. Computes diff between before and after state.
 */
export async function auditUpdate(
  ctx: AuditContext,
  entidadeTipo: string,
  entidadeId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Promise<void> {
  const diff = computeDiff(before, after);
  if (diff.changed.length === 0) return; // no actual changes

  await writeAuditLog({
    userId: ctx.userId,
    condominioId: ctx.condominioId,
    acao: `${entidadeTipo}_updated`,
    entidadeTipo,
    entidadeId,
    metadata: diff,
    request: ctx.request,
  });
}

/**
 * Audit a delete (soft delete) operation. Logs the entity snapshot before deletion.
 */
export async function auditDelete(
  ctx: AuditContext,
  entidadeTipo: string,
  entidadeId: string,
  before: Record<string, unknown>,
): Promise<void> {
  await writeAuditLog({
    userId: ctx.userId,
    condominioId: ctx.condominioId,
    acao: `${entidadeTipo}_deleted`,
    entidadeTipo,
    entidadeId,
    metadata: { before },
    request: ctx.request,
  });
}
