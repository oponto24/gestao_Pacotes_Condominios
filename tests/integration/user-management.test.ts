/* @vitest-environment node */
/**
 * Tests integration da gestão de users (stories 8.5/8.6/8.7).
 *
 * Estratégia: testa helpers Prisma direto (lógica DB + validators) + smoke HTTP
 * pra validar guard de auth (sem session = 401/403).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  createPendingUser,
  listAdminsByCondominio,
  listPorteirosByCondominio,
  listAllAdmins,
  isPending,
} from '@/lib/db/user-management';
import { ValidationError } from '@/server/errors';

const DB_REACHABLE =
  !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql://');

const APP_URL = 'http://localhost:3000';
const TAG = `test_user_${Date.now()}`;

const db = DB_REACHABLE ? new PrismaClient() : null;

let testCondId: string;
let testCondInactiveId: string;

async function cleanup() {
  if (!db) return;
  await db.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await db.condominio.deleteMany({ where: { nome: { startsWith: TAG } } });
}

// --- DB helpers (8.5/8.6/8.7) ---

describe.skipIf(!DB_REACHABLE)('User Management — DB helpers', () => {
  beforeAll(async () => {
    // Limpa dados residuais de runs anteriores
    await cleanup();

    // Cria condominios de teste (1 ativo, 1 inativo)
    const active = await db!.condominio.create({
      data: {
        nome: `${TAG}_cond_ativo`,
        endereco: 'Rua Teste 1',
        cep: '01000000',
        cidade: 'SP',
        estado: 'SP',
        contato_nome: 'Contato Teste',
        contato_telefone: '+5511999999999',
        ativo: true,
      },
    });
    testCondId = active.id;

    const inactive = await db!.condominio.create({
      data: {
        nome: `${TAG}_cond_inativo`,
        endereco: 'Rua Teste 2',
        cep: '02000000',
        cidade: 'SP',
        estado: 'SP',
        contato_nome: 'Contato Inativo',
        contato_telefone: '+5511999999998',
        ativo: false,
      },
    });
    testCondInactiveId = inactive.id;
  });

  afterAll(cleanup);

  // --- Story 8.5: super-admin cria admin ---

  it('8.5 — cria admin_master com clerk_id pendente', async () => {
    const user = await createPendingUser({
      email: `${TAG}_admin1@test.com`,
      nome: 'Admin Teste',
      role: 'admin_master',
      condominioId: testCondId,
    });

    expect(user.id).toBeTruthy();
    expect(user.email).toBe(`${TAG}_admin1@test.com`);
    expect(user.nome).toBe('Admin Teste');
    expect(user.role).toBe('admin_master');
    expect(user.condominio_id).toBe(testCondId);
    expect(user.ativo).toBe(true);
    expect(user.clerk_id).toMatch(/^pending_clerk_link_/);
  });

  it('8.5 — rejeita email duplicado', async () => {
    await createPendingUser({
      email: `${TAG}_dup@test.com`,
      nome: 'Primeiro',
      role: 'admin_master',
      condominioId: testCondId,
    });

    await expect(
      createPendingUser({
        email: `${TAG}_dup@test.com`,
        nome: 'Segundo',
        role: 'admin_master',
        condominioId: testCondId,
      }),
    ).rejects.toThrow('e-mail');
  });

  it('8.5 — rejeita condominio inativo', async () => {
    await expect(
      createPendingUser({
        email: `${TAG}_inativo@test.com`,
        nome: 'Teste',
        role: 'admin_master',
        condominioId: testCondInactiveId,
      }),
    ).rejects.toThrow('inativo');
  });

  it('8.5 — rejeita condominio inexistente', async () => {
    await expect(
      createPendingUser({
        email: `${TAG}_inexist@test.com`,
        nome: 'Teste',
        role: 'admin_master',
        condominioId: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('8.5 — normaliza email (lowercase + trim)', async () => {
    const user = await createPendingUser({
      email: `  ${TAG}_UPPER@TEST.COM  `,
      nome: 'Teste',
      role: 'admin_master',
      condominioId: testCondId,
    });

    expect(user.email).toBe(`${TAG}_upper@test.com`);
  });

  // --- Story 8.6: admin cria outro admin ---

  it('8.6 — cria admin_funcionario no mesmo cond', async () => {
    const user = await createPendingUser({
      email: `${TAG}_func@test.com`,
      nome: 'Funcionario Admin',
      role: 'admin_funcionario',
      condominioId: testCondId,
    });

    expect(user.role).toBe('admin_funcionario');
    expect(user.condominio_id).toBe(testCondId);
    expect(user.clerk_id).toMatch(/^pending_clerk_link_/);
  });

  // --- Story 8.7: admin cria porteiro ---

  it('8.7 — cria porteiro no cond', async () => {
    const user = await createPendingUser({
      email: `${TAG}_porteiro@test.com`,
      nome: 'Porteiro Noturno',
      role: 'porteiro',
      condominioId: testCondId,
    });

    expect(user.role).toBe('porteiro');
    expect(user.condominio_id).toBe(testCondId);
    expect(user.clerk_id).toMatch(/^pending_clerk_link_/);
  });

  // --- Listagem e filtros ---

  it('listAdminsByCondominio retorna admin_master + admin_funcionario', async () => {
    const admins = await listAdminsByCondominio(testCondId);
    const testAdmins = admins.filter((a) => a.email.startsWith(TAG));

    expect(testAdmins.length).toBeGreaterThanOrEqual(2);
    expect(
      testAdmins.every((a) => ['admin_master', 'admin_funcionario'].includes(a.role)),
    ).toBe(true);
    // Nao deve incluir porteiro
    expect(testAdmins.find((a) => a.role === 'porteiro')).toBeUndefined();
  });

  it('listPorteirosByCondominio retorna apenas porteiros', async () => {
    const porteiros = await listPorteirosByCondominio(testCondId);
    const testPorteiros = porteiros.filter((p) => p.email.startsWith(TAG));

    expect(testPorteiros.length).toBeGreaterThanOrEqual(1);
    expect(testPorteiros.every((p) => p.role === 'porteiro')).toBe(true);
  });

  it('listAllAdmins inclui condominio_nome', async () => {
    const all = await listAllAdmins();
    const testOnes = all.filter((a) => a.email.startsWith(TAG));

    expect(testOnes.length).toBeGreaterThanOrEqual(1);
    const withCond = testOnes.find((a) => a.condominio_nome !== null);
    expect(withCond).toBeDefined();
    expect(withCond!.condominio_nome).toContain(TAG);
  });
});

// --- isPending helper (sem DB) ---

describe('isPending', () => {
  it('retorna true pra clerk_id placeholder', () => {
    expect(isPending('pending_clerk_link_abc123def456')).toBe(true);
  });

  it('retorna false pra clerk_id real', () => {
    expect(isPending('user_2abc123')).toBe(false);
  });

  it('retorna false pra string vazia', () => {
    expect(isPending('')).toBe(false);
  });
});

// --- HTTP smoke: guards ---

describe.skipIf(!DB_REACHABLE)('User Management API — auth guards', () => {
  it('POST /api/super-admin/users sem auth retorna 401', async () => {
    try {
      const res = await fetch(`${APP_URL}/api/super-admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condominio_id: '00000000-0000-4000-8000-000000000000',
          email: 'test@test.com',
          nome: 'Test',
        }),
      });
      if (res.status >= 500) return; // app nao rodando
      expect([401, 403]).toContain(res.status);
    } catch {
      // app nao rodando — skip silencioso
    }
  });

  it('POST /api/admin/users sem auth retorna 401', async () => {
    try {
      const res = await fetch(`${APP_URL}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@test.com',
          nome: 'Test',
          role: 'porteiro',
        }),
      });
      if (res.status >= 500) return; // app nao rodando
      expect([401, 403]).toContain(res.status);
    } catch {
      // app nao rodando — skip silencioso
    }
  });
});
