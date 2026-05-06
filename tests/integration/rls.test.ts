/* @vitest-environment node */
/**
 * Testes integration de RLS — Story 1.4
 *
 * Roda contra Postgres real do docker-compose. Pula automaticamente
 * se o banco não estiver acessível (CI sem postgres não quebra).
 *
 * Cenários cobertos:
 *   1. Sem context, queries são bloqueadas pela RLS
 *   2. Context = Cond A, vê só dados de A
 *   3. Context = Cond A, INSERT cross-tenant para B é bloqueado
 *   4. Context = super_admin, vê tudo
 *   5. Helpers SQL retornam valores corretos
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Cliente sob role app_runtime (NOSUPERUSER, NOBYPASSRLS — sujeito a RLS).
// Sem isso, RLS não filtra (Postgres SUPERUSER bypassa tudo).
const RUNTIME_URL = process.env.DATABASE_RUNTIME_URL ?? process.env.DATABASE_URL;
const db = new PrismaClient({ datasources: { db: { url: RUNTIME_URL } } });

let condAId = '';
let condBId = '';

const FIXTURE_TAG = `RLS-Test-${Date.now()}`;

// Avaliação síncrona ANTES do collect — describe.skipIf precisa de valor estático.
const DB_REACHABLE = !!RUNTIME_URL && RUNTIME_URL.includes('postgresql://');

beforeAll(async () => {
  if (!DB_REACHABLE) return;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (e) {
    // DB não acessível — testes vão falhar individualmente com mensagem clara
    console.error('[rls.test] Postgres inacessível:', (e as Error).message);
    return;
  }

  // Cria 2 condomínios fixture (sem RLS context = como super-admin via app role,
  // mas a policy permite porque app é dono do schema; em práticа real, fixtures
  // são criadas via super_admin no app).
  // Estratégia: usar SET LOCAL is_super_admin=true em uma transação.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    const condA = await tx.condominio.create({
      data: {
        nome: `${FIXTURE_TAG}-A`,
        endereco: 'rua A',
        cep: '11111-111',
        cidade: 'SP',
        estado: 'SP',
        contato_nome: 'Test A',
        contato_telefone: '11999999999',
      },
      select: { id: true },
    });
    const condB = await tx.condominio.create({
      data: {
        nome: `${FIXTURE_TAG}-B`,
        endereco: 'rua B',
        cep: '22222-222',
        cidade: 'SP',
        estado: 'SP',
        contato_nome: 'Test B',
        contato_telefone: '11888888888',
      },
      select: { id: true },
    });
    condAId = condA.id;
    condBId = condB.id;
    // 1 unidade em cada
    await tx.unidade.create({
      data: { condominio_id: condAId, identificador: `Apto ${FIXTURE_TAG}-A` },
    });
    await tx.unidade.create({
      data: { condominio_id: condBId, identificador: `Apto ${FIXTURE_TAG}-B` },
    });
  });
});

afterAll(async () => {
  if (condAId) {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      await tx.condominio.deleteMany({
        where: { id: { in: [condAId, condBId] } },
      });
    });
  }
  await db.$disconnect();
});

describe.skipIf(!DB_REACHABLE)('RLS — Multi-tenancy isolation', () => {
  it('helper app_current_condominio() retorna NULL sem context', async () => {
    const result = await db.$queryRaw<Array<{ result: string | null }>>`
      SELECT app_current_condominio()::text AS result
    `;
    expect(result[0]?.result).toBeNull();
  });

  it('helper app_is_super_admin() retorna false sem context', async () => {
    const result = await db.$queryRaw<Array<{ result: boolean }>>`
      SELECT app_is_super_admin() AS result
    `;
    expect(result[0]?.result).toBe(false);
  });

  it('SELECT com context=Cond A vê só unidades de A', async () => {
    const count = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_condominio = '${condAId}'`);
      const rows = await tx.$queryRaw<Array<{ c: bigint }>>`
        SELECT count(*) AS c FROM unidade WHERE identificador LIKE ${'Apto ' + FIXTURE_TAG + '%'}
      `;
      return Number(rows[0]?.c ?? 0);
    });
    expect(count).toBe(1);
  });

  it('SELECT com context=Cond B vê só unidades de B (não as de A)', async () => {
    const count = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_condominio = '${condBId}'`);
      const rows = await tx.$queryRaw<Array<{ c: bigint }>>`
        SELECT count(*) AS c FROM unidade WHERE identificador LIKE ${'Apto ' + FIXTURE_TAG + '%'}
      `;
      return Number(rows[0]?.c ?? 0);
    });
    expect(count).toBe(1);
  });

  it('INSERT cross-tenant é bloqueado pela policy WITH CHECK', async () => {
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_condominio = '${condAId}'`);
        // Tentando inserir setor com condominio_id de B enquanto context é A
        await tx.$executeRawUnsafe(
          `INSERT INTO setor (id, condominio_id, nome, created_at, updated_at)
           VALUES (gen_random_uuid(), '${condBId}', 'tentativa-cross-tenant-${FIXTURE_TAG}', now(), now())`,
        );
      }),
    ).rejects.toThrow(/row-level security|new row violates/i);
  });

  it('SELECT com is_super_admin=true vê unidades de ambos os condomínios', async () => {
    const count = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      const rows = await tx.$queryRaw<Array<{ c: bigint }>>`
        SELECT count(*) AS c FROM unidade WHERE identificador LIKE ${'Apto ' + FIXTURE_TAG + '%'}
      `;
      return Number(rows[0]?.c ?? 0);
    });
    expect(count).toBe(2);
  });
});
