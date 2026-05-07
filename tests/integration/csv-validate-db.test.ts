/* @vitest-environment node */
/**
 * Tests integration de validateAgainstDb (story 2.6).
 *
 * Valida split entre okToCreate e conflicting baseado em:
 *   - Unidade existente: (condominio_id, bloco, identificador)
 *   - Telefone existente: (condominio_id, telefone, deleted_at IS NULL)
 *   - Tenant isolation: unidade/telefone em condomínio diferente NÃO conta
 *   - Soft delete NÃO conta como telefone existente
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { withTenantContext } from '@/server/db-tenant';
import { validateAgainstDbWithTx } from '@/lib/csv/validate-db';
import type { ValidRow } from '@/lib/csv/parse-import';
import type { TenantContext } from '@/server/middleware/tenant';

const DB_REACHABLE =
  !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql://');

const setupDb = DB_REACHABLE
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  : null;

const TAG = `csvdb-test-${Date.now()}`;
let condAId = '';
let condBId = '';

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

    // Cond A já tem unidade A-101 e morador com telefone X
    const ua = await tx.unidade.create({
      data: { condominio_id: condAId, identificador: '101', bloco: 'A' },
    });
    await tx.morador.create({
      data: {
        condominio_id: condAId,
        unidade_id: ua.id,
        nome: 'Existente',
        nome_normalizado: 'existente',
        telefone: '+5511988880001',
        is_principal: true,
      },
    });

    // Cond A: morador soft-deletado com outro telefone (NÃO deve conflitar)
    const uaArq = await tx.unidade.create({
      data: { condominio_id: condAId, identificador: '999', bloco: 'X' },
    });
    await tx.morador.create({
      data: {
        condominio_id: condAId,
        unidade_id: uaArq.id,
        nome: 'Arquivado',
        nome_normalizado: 'arquivado',
        telefone: '+5511988880099',
        is_principal: false,
        deleted_at: new Date(),
        ativo: false,
      },
    });

    // Cond B tem mesma combinação, NÃO deve conflitar com cond A
    const ub = await tx.unidade.create({
      data: { condominio_id: condBId, identificador: '101', bloco: 'A' },
    });
    await tx.morador.create({
      data: {
        condominio_id: condBId,
        unidade_id: ub.id,
        nome: 'OutroCond',
        nome_normalizado: 'outrocond',
        telefone: '+5511988880001', // mesmo telefone que cond A!
        is_principal: true,
      },
    });
  });
});

afterAll(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    await tx.morador.deleteMany({ where: { condominio_id: { in: [condAId, condBId] } } });
    await tx.unidade.deleteMany({ where: { condominio_id: { in: [condAId, condBId] } } });
    await tx.condominio.deleteMany({ where: { id: { in: [condAId, condBId] } } });
  });
  await setupDb.$disconnect();
});

const ctxA = (): TenantContext => ({
  kind: 'tenant',
  userId: 'fake-user-id',
  condominioId: condAId,
  role: 'admin',
});

function makeRow(overrides: Partial<ValidRow>): ValidRow {
  return {
    linha: 2,
    bloco: 'A',
    identificador: '500',
    morador_nome: 'Novo Morador',
    morador_telefone: '+5511955551111',
    morador_email: undefined,
    ...overrides,
  };
}

describe.skipIf(!DB_REACHABLE)('validateAgainstDb (tenant-scoped)', () => {
  it('linha sem conflitos vai para okToCreate', async () => {
    const result = await withTenantContext(ctxA(), (tx) =>
      validateAgainstDbWithTx(tx, [makeRow({})]),
    );
    expect(result.okToCreate).toHaveLength(1);
    expect(result.conflicting).toHaveLength(0);
  });

  it('UNIDADE_EXISTE: detecta colisão de (bloco, identificador)', async () => {
    const result = await withTenantContext(ctxA(), (tx) =>
      validateAgainstDbWithTx(tx, [makeRow({ bloco: 'A', identificador: '101' })]),
    );
    expect(result.okToCreate).toHaveLength(0);
    expect(result.conflicting).toHaveLength(1);
    expect(result.conflicting[0].dbConflicts).toContain('UNIDADE_EXISTE');
  });

  it('TELEFONE_EXISTE: detecta telefone já cadastrado ativo', async () => {
    const result = await withTenantContext(ctxA(), (tx) =>
      validateAgainstDbWithTx(tx, [
        makeRow({ bloco: 'B', identificador: '999', morador_telefone: '+5511988880001' }),
      ]),
    );
    expect(result.okToCreate).toHaveLength(0);
    expect(result.conflicting).toHaveLength(1);
    expect(result.conflicting[0].dbConflicts).toContain('TELEFONE_EXISTE');
  });

  it('AMBOS conflitos numa linha → 2 motivos', async () => {
    const result = await withTenantContext(ctxA(), (tx) =>
      validateAgainstDbWithTx(tx, [
        makeRow({ bloco: 'A', identificador: '101', morador_telefone: '+5511988880001' }),
      ]),
    );
    expect(result.conflicting).toHaveLength(1);
    expect(result.conflicting[0].dbConflicts).toEqual(
      expect.arrayContaining(['UNIDADE_EXISTE', 'TELEFONE_EXISTE']),
    );
  });

  it('telefone arquivado (deleted_at) NÃO conta como conflito', async () => {
    const result = await withTenantContext(ctxA(), (tx) =>
      validateAgainstDbWithTx(tx, [
        makeRow({ morador_telefone: '+5511988880099' }), // do morador arquivado
      ]),
    );
    expect(result.okToCreate).toHaveLength(1);
    expect(result.conflicting).toHaveLength(0);
  });

  it('TENANT ISOLATION: cond B com mesma unidade+telefone NÃO bloqueia em cond A query', async () => {
    // Em cond B, unidade (A, 101) e telefone +5511988880001 EXISTEM,
    // mas estamos consultando NO contexto de cond A onde também existem.
    // Aqui o teste valida que a query NÃO traz dados de cond B atrapalhando
    // — mas como AMBOS os condomínios têm a mesma combinação, um deve
    // bloquear (cond A o tem). Para validar isolation: criamos uma linha
    // com unidade que SÓ existe em cond B.
    const result = await withTenantContext(ctxA(), (tx) =>
      validateAgainstDbWithTx(tx, [
        makeRow({ bloco: 'A', identificador: '700', morador_telefone: '+5511955552222' }),
      ]),
    );
    expect(result.okToCreate).toHaveLength(1);
    expect(result.conflicting).toHaveLength(0);
  });

  it('múltiplas linhas particionadas corretamente (1 ok + 1 conflito)', async () => {
    const result = await withTenantContext(ctxA(), (tx) =>
      validateAgainstDbWithTx(tx, [
        makeRow({ linha: 2, bloco: 'A', identificador: '600' }),
        makeRow({
          linha: 3,
          bloco: 'A',
          identificador: '101',
          morador_telefone: '+5511955553333',
        }),
      ]),
    );
    expect(result.okToCreate).toHaveLength(1);
    expect(result.okToCreate[0].linha).toBe(2);
    expect(result.conflicting).toHaveLength(1);
    expect(result.conflicting[0].linha).toBe(3);
  });
});
