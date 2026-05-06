/* @vitest-environment node */
/**
 * Testes integration do middleware tenant — Story 1.6
 *
 * Testa `withTenantContext` diretamente (sem passar por getTenantContext,
 * que depende de auth Clerk no request real). Para o flow completo
 * end-to-end com auth, ver smoke manual via curl + browser na story.
 *
 * Cobertura:
 *   1. tenant context A → vê só dados de A
 *   2. tenant context B → vê só dados de B
 *   3. super_admin context → vê tudo
 *   4. INSERT cross-tenant é bloqueado pelo RLS
 *   5. Sem vazamento entre chamadas sequenciais (Cond A → Cond B → A)
 *   6. withTenantContext sempre wrappa em transação (SET LOCAL persiste)
 *
 * Skips automaticamente se DB inacessível.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { withTenantContext } from '@/server/db-tenant';
import type { TenantContext } from '@/server/middleware/tenant';

const RUNTIME_URL = process.env.DATABASE_RUNTIME_URL ?? process.env.DATABASE_URL;
const DB_REACHABLE = !!RUNTIME_URL && RUNTIME_URL.includes('postgresql://');

// Cliente "raw" só para setup de fixtures (usa app role com SUPERUSER bypass).
// O withTenantContext internamente usa o `db` de @/lib/db (app_runtime).
const setupDb = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const TAG = `mw-test-${Date.now()}`;
let condAId = '';
let condBId = '';

beforeAll(async () => {
  if (!DB_REACHABLE) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    const a = await tx.condominio.create({
      data: {
        nome: `${TAG}-A`,
        endereco: 'r',
        cep: '1',
        cidade: 'SP',
        estado: 'SP',
        contato_nome: 'A',
        contato_telefone: '11',
      },
      select: { id: true },
    });
    const b = await tx.condominio.create({
      data: {
        nome: `${TAG}-B`,
        endereco: 'r',
        cep: '2',
        cidade: 'SP',
        estado: 'SP',
        contato_nome: 'B',
        contato_telefone: '12',
      },
      select: { id: true },
    });
    condAId = a.id;
    condBId = b.id;
    await tx.unidade.create({
      data: { condominio_id: condAId, identificador: `Apto ${TAG}-A` },
    });
    await tx.unidade.create({
      data: { condominio_id: condBId, identificador: `Apto ${TAG}-B` },
    });
  });
});

afterAll(async () => {
  if (condAId) {
    await setupDb.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      await tx.condominio.deleteMany({ where: { id: { in: [condAId, condBId] } } });
    });
  }
  await setupDb.$disconnect();
});

const ctxA = (): TenantContext => ({
  kind: 'tenant',
  userId: '00000000-0000-0000-0000-000000000001',
  condominioId: condAId,
  role: 'admin',
});

const ctxB = (): TenantContext => ({
  kind: 'tenant',
  userId: '00000000-0000-0000-0000-000000000002',
  condominioId: condBId,
  role: 'admin',
});

const ctxSuperAdmin = (): TenantContext => ({
  kind: 'super_admin',
  userId: '00000000-0000-0000-0000-000000000099',
});

describe.skipIf(!DB_REACHABLE)('withTenantContext — RLS automático', () => {
  it('tenant A vê só unidades de A', async () => {
    const rows = await withTenantContext(ctxA(), async (tx) => {
      return tx.unidade.findMany({
        where: { identificador: { startsWith: `Apto ${TAG}` } },
        select: { identificador: true },
      });
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.identificador).toBe(`Apto ${TAG}-A`);
  });

  it('tenant B vê só unidades de B', async () => {
    const rows = await withTenantContext(ctxB(), async (tx) => {
      return tx.unidade.findMany({
        where: { identificador: { startsWith: `Apto ${TAG}` } },
        select: { identificador: true },
      });
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.identificador).toBe(`Apto ${TAG}-B`);
  });

  it('super_admin vê unidades de A e B', async () => {
    const rows = await withTenantContext(ctxSuperAdmin(), async (tx) => {
      return tx.unidade.findMany({
        where: { identificador: { startsWith: `Apto ${TAG}` } },
        select: { identificador: true },
      });
    });
    expect(rows).toHaveLength(2);
  });

  it('INSERT cross-tenant (context A → grava em B) é bloqueado pelo RLS', async () => {
    await expect(
      withTenantContext(ctxA(), async (tx) => {
        return tx.$executeRawUnsafe(
          `INSERT INTO setor (id, condominio_id, nome, created_at, updated_at)
           VALUES (gen_random_uuid(), '${condBId}', 'hack-${TAG}', now(), now())`,
        );
      }),
    ).rejects.toThrow(/row-level security|new row violates/i);
  });

  it('NÃO vaza contexto entre chamadas sequenciais (A → B → A)', async () => {
    const a1 = await withTenantContext(ctxA(), async (tx) => {
      return tx.unidade.findMany({
        where: { identificador: { startsWith: `Apto ${TAG}` } },
        select: { identificador: true },
      });
    });
    const b1 = await withTenantContext(ctxB(), async (tx) => {
      return tx.unidade.findMany({
        where: { identificador: { startsWith: `Apto ${TAG}` } },
        select: { identificador: true },
      });
    });
    const a2 = await withTenantContext(ctxA(), async (tx) => {
      return tx.unidade.findMany({
        where: { identificador: { startsWith: `Apto ${TAG}` } },
        select: { identificador: true },
      });
    });
    expect(a1).toHaveLength(1);
    expect(a1[0]?.identificador).toBe(`Apto ${TAG}-A`);
    expect(b1).toHaveLength(1);
    expect(b1[0]?.identificador).toBe(`Apto ${TAG}-B`);
    expect(a2).toHaveLength(1);
    expect(a2[0]?.identificador).toBe(`Apto ${TAG}-A`);
  });

  it('SET LOCAL persiste DURANTE a transação (current_setting funciona)', async () => {
    const setting = await withTenantContext(ctxA(), async (tx) => {
      const rows = await tx.$queryRaw<Array<{ v: string | null }>>`
        SELECT current_setting('app.current_condominio', true) AS v
      `;
      return rows[0]?.v;
    });
    expect(setting).toBe(condAId);
  });
});
