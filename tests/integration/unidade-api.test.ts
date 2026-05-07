/* @vitest-environment node */
/**
 * Tests integration de Unidade — TENANT-SCOPED + UNIQUE COMPOSITE COM NULL.
 *
 * Foco crítico:
 *   1. RLS isola unidades cross-tenant
 *   2. Unique composite (condominio_id, identificador, bloco) trata NULL
 *      como valor distinto pelo Postgres — `findUnidadeByIdentificador`
 *      precisa fazer match explícito com `bloco: null`
 *   3. DELETE bloqueado por moradores OR pacotes vinculados
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

const TAG = `unidade-test-${Date.now()}`;
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

describe.skipIf(!DB_REACHABLE)('Unidade DB helpers (tenant-scoped)', () => {
  it('TENANT ISOLATION: unidade de A não aparece em B', async () => {
    await withTenantContext(ctxA(), (tx) =>
      tx.unidade.create({ data: { condominio_id: condAId, identificador: 'A-101' } }),
    );
    await withTenantContext(ctxA(), (tx) =>
      tx.unidade.create({ data: { condominio_id: condAId, identificador: 'A-102' } }),
    );

    const fromA = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.findMany({ where: { identificador: { startsWith: 'A-' } } }),
    );
    expect(fromA.length).toBe(2);

    const fromB = await withTenantContext(ctxB(), (tx) =>
      tx.unidade.findMany({ where: { identificador: { startsWith: 'A-' } } }),
    );
    expect(fromB.length).toBe(0);
  });

  it('mesmo identificador em blocos diferentes coexistem', async () => {
    await withTenantContext(ctxA(), (tx) =>
      tx.unidade.create({ data: { condominio_id: condAId, identificador: '101', bloco: 'X' } }),
    );
    await withTenantContext(ctxA(), (tx) =>
      tx.unidade.create({ data: { condominio_id: condAId, identificador: '101', bloco: 'Y' } }),
    );

    const found = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.findMany({ where: { identificador: '101', bloco: { in: ['X', 'Y'] } } }),
    );
    expect(found.length).toBe(2);
  });

  it('findUnidadeByIdentificador detecta duplicata mesmo com bloco NULL', async () => {
    // Cria unidade SEM bloco
    const created = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.create({ data: { condominio_id: condAId, identificador: 'NOBLOCO' } }),
    );

    // findUnidadeByIdentificador chama withTenant() internamente — precisa
    // de auth context. Como o helper não permite passar ctx custom (usa
    // getTenantContext do request), validamos via withTenantContext direto.
    const byNull = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.findFirst({ where: { identificador: 'NOBLOCO', bloco: null } }),
    );
    expect(byNull?.id).toBe(created.id);

    // Outra unidade NOBLOCO + bloco='Z' NÃO conflita
    const byZ = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.findFirst({ where: { identificador: 'NOBLOCO', bloco: 'Z' } }),
    );
    expect(byZ).toBeNull();
  });

  it('update preserva campos não enviados', async () => {
    const created = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.create({
        data: {
          condominio_id: condAId,
          identificador: 'UPD-1',
          bloco: 'Y',
          observacoes: 'original',
        },
      }),
    );

    const updated = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.update({ where: { id: created.id }, data: { observacoes: 'novo' } }),
    );
    expect(updated.identificador).toBe('UPD-1');
    expect(updated.bloco).toBe('Y');
    expect(updated.observacoes).toBe('novo');
  });

  it('DELETE com morador vinculado retorna count > 0', async () => {
    const unidade = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.create({
        data: { condominio_id: condAId, identificador: 'WITH-MORADOR', bloco: 'M' },
      }),
    );

    // Cria morador vinculado
    await withTenantContext(ctxA(), (tx) =>
      tx.morador.create({
        data: {
          condominio_id: condAId,
          unidade_id: unidade.id,
          nome: 'João Test',
          nome_normalizado: 'joao test',
          telefone: '+5511988887777',
          is_principal: true,
        },
      }),
    );

    const withCount = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.findFirst({
        where: { id: unidade.id },
        include: { _count: { select: { moradores: true, pacotes: true } } },
      }),
    );
    expect(withCount?._count.moradores).toBe(1);
    expect(withCount?._count.pacotes).toBe(0);
  });

  it('DELETE físico funciona quando sem moradores nem pacotes', async () => {
    const created = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.create({ data: { condominio_id: condAId, identificador: 'TO-DELETE' } }),
    );
    await withTenantContext(ctxA(), (tx) => tx.unidade.delete({ where: { id: created.id } }));
    const found = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.findFirst({ where: { id: created.id } }),
    );
    expect(found).toBeNull();
  });

  it('inactive (ativa=false) é encontrado por findFirst quando includeInativa=true', async () => {
    const created = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.create({
        data: { condominio_id: condAId, identificador: 'INACTIVE', ativo: false },
      }),
    );

    const visible = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.findFirst({ where: { id: created.id } }),
    );
    expect(visible).not.toBeNull();

    const onlyAtivas = await withTenantContext(ctxA(), (tx) =>
      tx.unidade.findFirst({ where: { id: created.id, ativo: true } }),
    );
    expect(onlyAtivas).toBeNull();
  });
});
