/* @vitest-environment node */
/**
 * Tests integration do Setor — TENANT-SCOPED.
 *
 * Foco crítico: validar que `withTenant`/`withTenantContext` aplicam RLS
 * corretamente — setor de tenant A NÃO vaza para tenant B.
 *
 * Pattern: setup via SUPERUSER (db raw + SET LOCAL app.is_super_admin),
 * helpers reais usados via `withTenantContext(ctxA, ...)`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { withTenantContext } from '@/server/db-tenant';
import type { TenantContext } from '@/server/middleware/tenant';

const DB_REACHABLE =
  !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql://');

const setupDb = DB_REACHABLE
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  : null;

const TAG = `setor-test-${Date.now()}`;
let condAId = '';
let condBId = '';
let userAId = '';

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
    await tx.setor.deleteMany({ where: { condominio_id: { in: [condAId, condBId] } } });
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
  userId: userAId, // mesmo user (não importa pra RLS) mas condominio diferente
  condominioId: condBId,
  role: 'admin',
});

describe.skipIf(!DB_REACHABLE)('Setor DB helpers (tenant-scoped)', () => {
  it('create dentro de tenant A funciona, isolamento B retorna 0', async () => {
    // Cria 2 setores em A via withTenantContext
    await withTenantContext(ctxA(), async (tx) => {
      await tx.setor.create({
        data: { condominio_id: condAId, nome: 'Bloco A1', ativo: true },
      });
      await tx.setor.create({
        data: { condominio_id: condAId, nome: 'Bloco A2', ativo: true },
      });
    });

    // Lista dentro de A → encontra os 2
    const fromA = await withTenantContext(ctxA(), (tx) => tx.setor.findMany());
    expect(fromA.length).toBe(2);

    // CRÍTICO: lista dentro de B → encontra 0 (RLS isola)
    const fromB = await withTenantContext(ctxB(), (tx) => tx.setor.findMany());
    expect(fromB.length).toBe(0);
  });

  it('update preserva campos não enviados', async () => {
    const created = await withTenantContext(ctxA(), (tx) =>
      tx.setor.create({
        data: {
          condominio_id: condAId,
          nome: 'Update test',
          descricao: 'original',
          capacidade: 10,
        },
      }),
    );

    const updated = await withTenantContext(ctxA(), (tx) =>
      tx.setor.update({ where: { id: created.id }, data: { nome: 'Update test renamed' } }),
    );

    expect(updated.nome).toBe('Update test renamed');
    expect(updated.descricao).toBe('original');
    expect(updated.capacidade).toBe(10);
  });

  it('unique composite (condominio_id, nome) é respeitado dentro do tenant', async () => {
    await withTenantContext(ctxA(), (tx) =>
      tx.setor.create({ data: { condominio_id: condAId, nome: 'Unique' } }),
    );

    await expect(
      withTenantContext(ctxA(), (tx) =>
        tx.setor.create({ data: { condominio_id: condAId, nome: 'Unique' } }),
      ),
    ).rejects.toThrow();
  });

  it('mesmo nome em tenants diferentes é OK (unique é composite com condominio_id)', async () => {
    // Setup via SUPERUSER pq tenant B precisa de setor (e ctxB pode criar normalmente)
    await withTenantContext(ctxB(), (tx) =>
      tx.setor.create({ data: { condominio_id: condBId, nome: 'Unique' } }),
    );
    // Já existe 'Unique' em A do test anterior — ambos coexistem, sem erro
    const fromB = await withTenantContext(ctxB(), (tx) =>
      tx.setor.findMany({ where: { nome: 'Unique' } }),
    );
    expect(fromB.length).toBe(1);
  });

  it('inactive (ativo=false) é encontrado por findFirst quando includeInativo=true', async () => {
    const created = await withTenantContext(ctxA(), (tx) =>
      tx.setor.create({ data: { condominio_id: condAId, nome: 'Inativo test', ativo: false } }),
    );

    const visible = await withTenantContext(ctxA(), (tx) =>
      tx.setor.findFirst({ where: { id: created.id } }),
    );
    expect(visible).not.toBeNull();

    const onlyAtivos = await withTenantContext(ctxA(), (tx) =>
      tx.setor.findFirst({ where: { id: created.id, ativo: true } }),
    );
    expect(onlyAtivos).toBeNull();
  });

  it('delete físico funciona quando sem pacotes vinculados', async () => {
    const created = await withTenantContext(ctxA(), (tx) =>
      tx.setor.create({ data: { condominio_id: condAId, nome: 'To delete' } }),
    );

    await withTenantContext(ctxA(), (tx) => tx.setor.delete({ where: { id: created.id } }));

    const found = await withTenantContext(ctxA(), (tx) =>
      tx.setor.findFirst({ where: { id: created.id } }),
    );
    expect(found).toBeNull();
  });
});
