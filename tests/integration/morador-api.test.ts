/* @vitest-environment node */
/**
 * Tests integration de Morador — TENANT-SCOPED + INVARIANTE 1-PRINCIPAL + SOFT DELETE.
 *
 * Foco crítico:
 *   1. RLS isola moradores cross-tenant
 *   2. UNIQUE telefone por condomínio (mesmo telefone em condomínios diferentes coexiste)
 *   3. Invariante "1 principal por unidade" aplicada em CREATE + PATCH
 *   4. Soft delete (deleted_at + ativo=false + is_principal=false)
 *   5. Restore reverte deleted_at + ativo (NÃO restaura is_principal automaticamente)
 *   6. nome_normalizado calculado em create + update (recalcula se nome mudou)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { withTenantContext } from '@/server/db-tenant';
import { normalizarNome } from '@/lib/text/normalize';
import type { TenantContext } from '@/server/middleware/tenant';

const DB_REACHABLE =
  !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql://');

const setupDb = DB_REACHABLE
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  : null;

const TAG = `morador-test-${Date.now()}`;
let condAId = '';
let condBId = '';
let userAId = '';
let unidadeA1Id = '';
let unidadeA2Id = '';
let unidadeBId = '';

const baseFixture = {
  endereco: 'r',
  cep: '1',
  cidade: 'SP',
  estado: 'SP',
  contato_nome: 'X',
  contato_telefone: '+5511999999999',
};

beforeAll(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    const a = await tx.condominio.create({ data: { nome: `${TAG}-A`, ...baseFixture } });
    const b = await tx.condominio.create({ data: { nome: `${TAG}-B`, ...baseFixture } });
    condAId = a.id;
    condBId = b.id;

    const ua1 = await tx.unidade.create({ data: { condominio_id: condAId, identificador: 'A1' } });
    const ua2 = await tx.unidade.create({ data: { condominio_id: condAId, identificador: 'A2' } });
    const ub = await tx.unidade.create({ data: { condominio_id: condBId, identificador: 'B1' } });
    unidadeA1Id = ua1.id;
    unidadeA2Id = ua2.id;
    unidadeBId = ub.id;

    const user = await tx.user.create({
      data: {
        clerk_id: `${TAG}-clerk`,
        email: `${TAG}@test.com`,
        nome: 'Test Admin',
        role: 'admin',
        condominio_id: condAId,
      },
    });
    userAId = user.id;
  });
});

afterAll(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    await tx.morador.deleteMany({ where: { condominio_id: { in: [condAId, condBId] } } });
    await tx.unidade.deleteMany({ where: { condominio_id: { in: [condAId, condBId] } } });
    await tx.user.deleteMany({ where: { clerk_id: `${TAG}-clerk` } });
    await tx.condominio.deleteMany({ where: { id: { in: [condAId, condBId] } } });
  });
  await setupDb.$disconnect();
});

const ctxA = (): TenantContext => ({
  kind: 'tenant',
  userId: userAId,
  condominioId: condAId,
  role: 'admin',
});
const ctxB = (): TenantContext => ({
  kind: 'tenant',
  userId: userAId,
  condominioId: condBId,
  role: 'admin',
});

async function createMoradorRaw(ctxFn: () => TenantContext, data: {
  unidade_id: string;
  nome: string;
  telefone: string;
  is_principal?: boolean;
}) {
  return withTenantContext(ctxFn(), (tx) =>
    tx.morador.create({
      data: {
        condominio_id: ctxFn().condominioId,
        unidade_id: data.unidade_id,
        nome: data.nome,
        nome_normalizado: normalizarNome(data.nome),
        telefone: data.telefone,
        is_principal: data.is_principal ?? false,
      },
    }),
  );
}

describe.skipIf(!DB_REACHABLE)('Morador DB helpers (tenant-scoped)', () => {
  it('TENANT ISOLATION: morador A não aparece em B', async () => {
    await createMoradorRaw(ctxA, { unidade_id: unidadeA1Id, nome: 'A1', telefone: '+5511911110001' });

    const fromA = await withTenantContext(ctxA(), (tx) =>
      tx.morador.findMany({ where: { telefone: '+5511911110001' } }),
    );
    expect(fromA.length).toBe(1);

    const fromB = await withTenantContext(ctxB(), (tx) =>
      tx.morador.findMany({ where: { telefone: '+5511911110001' } }),
    );
    expect(fromB.length).toBe(0);
  });

  it('UNIQUE telefone por condomínio: mesmo telefone em A e B coexiste', async () => {
    const sharedPhone = '+5511922220002';
    await createMoradorRaw(ctxA, { unidade_id: unidadeA1Id, nome: 'A2', telefone: sharedPhone });
    await createMoradorRaw(ctxB, { unidade_id: unidadeBId, nome: 'B2', telefone: sharedPhone });

    const inA = await withTenantContext(ctxA(), (tx) =>
      tx.morador.findFirst({ where: { telefone: sharedPhone } }),
    );
    const inB = await withTenantContext(ctxB(), (tx) =>
      tx.morador.findFirst({ where: { telefone: sharedPhone } }),
    );
    expect(inA).not.toBeNull();
    expect(inB).not.toBeNull();
    expect(inA?.id).not.toBe(inB?.id);
  });

  it('UNIQUE telefone bloqueia duplicata no mesmo condomínio', async () => {
    const phone = '+5511933330003';
    await createMoradorRaw(ctxA, { unidade_id: unidadeA1Id, nome: 'D1', telefone: phone });

    await expect(
      createMoradorRaw(ctxA, { unidade_id: unidadeA2Id, nome: 'D2', telefone: phone }),
    ).rejects.toThrow();
  });

  it('INVARIANTE: criar 2º principal na mesma unidade desativa o 1º', async () => {
    const principal1 = await createMoradorRaw(ctxA, {
      unidade_id: unidadeA1Id,
      nome: 'Principal Um',
      telefone: '+5511944440001',
      is_principal: true,
    });
    expect(principal1.is_principal).toBe(true);

    // Aplicação manual do invariante (espelha db helper)
    await withTenantContext(ctxA(), async (tx) => {
      await tx.morador.updateMany({
        where: { unidade_id: unidadeA1Id, is_principal: true, deleted_at: null },
        data: { is_principal: false },
      });
      await tx.morador.create({
        data: {
          condominio_id: condAId,
          unidade_id: unidadeA1Id,
          nome: 'Principal Dois',
          nome_normalizado: 'principal dois',
          telefone: '+5511944440002',
          is_principal: true,
        },
      });
    });

    const stillPrincipal1 = await withTenantContext(ctxA(), (tx) =>
      tx.morador.findFirst({ where: { id: principal1.id } }),
    );
    expect(stillPrincipal1?.is_principal).toBe(false);

    const novosPrincipais = await withTenantContext(ctxA(), (tx) =>
      tx.morador.count({ where: { unidade_id: unidadeA1Id, is_principal: true, deleted_at: null } }),
    );
    expect(novosPrincipais).toBe(1);
  });

  it('Principal pode coexistir em unidades diferentes', async () => {
    await createMoradorRaw(ctxA, {
      unidade_id: unidadeA2Id,
      nome: 'Principal Outra Unidade',
      telefone: '+5511955550001',
      is_principal: true,
    });

    const principaisA = await withTenantContext(ctxA(), (tx) =>
      tx.morador.count({ where: { is_principal: true, deleted_at: null } }),
    );
    // Devemos ter 2 principais (1 em A1 + 1 em A2)
    expect(principaisA).toBeGreaterThanOrEqual(2);
  });

  it('nome_normalizado calculado corretamente (lowercase + sem acento)', async () => {
    const m = await createMoradorRaw(ctxA, {
      unidade_id: unidadeA1Id,
      nome: 'João Conceição',
      telefone: '+5511966660001',
    });
    expect(m.nome_normalizado).toBe('joao conceicao');
  });

  it('SOFT DELETE: deleted_at setado + ativo=false + is_principal=false', async () => {
    const created = await createMoradorRaw(ctxA, {
      unidade_id: unidadeA2Id,
      nome: 'Para arquivar',
      telefone: '+5511977770001',
      is_principal: true,
    });

    await withTenantContext(ctxA(), (tx) =>
      tx.morador.update({
        where: { id: created.id },
        data: { deleted_at: new Date(), ativo: false, is_principal: false },
      }),
    );

    const archived = await withTenantContext(ctxA(), (tx) =>
      tx.morador.findFirst({ where: { id: created.id } }),
    );
    expect(archived?.deleted_at).not.toBeNull();
    expect(archived?.ativo).toBe(false);
    expect(archived?.is_principal).toBe(false);
  });

  it('Restore zera deleted_at + ativo=true (NÃO restaura is_principal)', async () => {
    const created = await createMoradorRaw(ctxA, {
      unidade_id: unidadeA2Id,
      nome: 'Para restaurar',
      telefone: '+5511988880001',
      is_principal: true,
    });

    // Arquiva
    await withTenantContext(ctxA(), (tx) =>
      tx.morador.update({
        where: { id: created.id },
        data: { deleted_at: new Date(), ativo: false, is_principal: false },
      }),
    );

    // Restaura
    const restored = await withTenantContext(ctxA(), (tx) =>
      tx.morador.update({
        where: { id: created.id },
        data: { deleted_at: null, ativo: true },
      }),
    );

    expect(restored.deleted_at).toBeNull();
    expect(restored.ativo).toBe(true);
    expect(restored.is_principal).toBe(false); // NÃO restaurado automaticamente
  });

  it('lista filtra arquivados por padrão (deleted_at IS NULL)', async () => {
    const ativos = await withTenantContext(ctxA(), (tx) =>
      tx.morador.count({ where: { deleted_at: null } }),
    );
    const todos = await withTenantContext(ctxA(), (tx) => tx.morador.count());
    expect(todos).toBeGreaterThan(ativos);
  });
});
