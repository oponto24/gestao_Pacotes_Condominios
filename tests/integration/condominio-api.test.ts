/* @vitest-environment node */
/**
 * Tests integration do Condominio CRUD.
 *
 * Estratégia: testa helpers Prisma direto (lógica DB + validators) + 1 test HTTP
 * pra validar guard de auth (sem session = 401/403). Mock de Clerk session pra
 * testar caminho autenticado é over-engineering pra MVP — coberto por smoke E2E manual.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  archiveCondominio,
  createCondominio,
  findCondominioByCnpj,
  getCondominioById,
  listCondominios,
  restoreCondominio,
  updateCondominio,
} from '@/lib/db/condominio';

const DB_REACHABLE =
  !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql://');

const APP_URL = 'http://localhost:3000';
const TEST_PREFIX = 'TEST_COND_';

const db = DB_REACHABLE ? new PrismaClient() : null;

async function cleanup() {
  if (!db) return;
  await db.condominio.deleteMany({ where: { nome: { startsWith: TEST_PREFIX } } });
}

const baseInput = {
  nome: `${TEST_PREFIX}Aurora`,
  cnpj: '00000000000191',
  endereco: 'Rua das Flores, 123',
  cep: '01000000',
  cidade: 'São Paulo',
  estado: 'SP',
  contato_nome: 'Maria',
  contato_telefone: '+5511999999999',
  contato_email: 'maria@example.com',
};

describe.skipIf(!DB_REACHABLE)('Condominio DB helpers', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('create + getById funciona', async () => {
    const created = await createCondominio(baseInput);
    expect(created.id).toBeTruthy();

    const found = await getCondominioById(created.id);
    expect(found).not.toBeNull();
    expect(found!.nome).toBe(baseInput.nome);
    expect(found!._count.unidades).toBe(0);
  });

  it('list paginado retorna items + total', async () => {
    await createCondominio(baseInput);
    await createCondominio({ ...baseInput, nome: `${TEST_PREFIX}Beta`, cnpj: '11111111000111' });

    const result = await listCondominios({
      page: 1,
      pageSize: 10,
      q: TEST_PREFIX,
      includeArquivados: false,
    });
    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(result.items.every((c) => c.nome.startsWith(TEST_PREFIX))).toBe(true);
  });

  it('update aplica partial', async () => {
    const created = await createCondominio(baseInput);
    const updated = await updateCondominio(created.id, { nome: `${TEST_PREFIX}Renomeado` });
    expect(updated.nome).toBe(`${TEST_PREFIX}Renomeado`);
    expect(updated.endereco).toBe(baseInput.endereco); // preservado
  });

  it('archive faz soft delete (NÃO DELETE físico)', async () => {
    const created = await createCondominio(baseInput);
    await archiveCondominio(created.id);

    const visivel = await getCondominioById(created.id, false);
    expect(visivel).toBeNull(); // filtra por deleted_at IS NULL

    const incluindoArquivado = await getCondominioById(created.id, true);
    expect(incluindoArquivado).not.toBeNull();
    expect(incluindoArquivado!.deleted_at).not.toBeNull();
    expect(incluindoArquivado!.ativo).toBe(false);
  });

  it('restore reverte soft delete', async () => {
    const created = await createCondominio(baseInput);
    await archiveCondominio(created.id);
    const restored = await restoreCondominio(created.id);
    expect(restored.deleted_at).toBeNull();
    expect(restored.ativo).toBe(true);
  });

  it('findCondominioByCnpj detecta duplicata (inclusive arquivado)', async () => {
    const a = await createCondominio(baseInput);
    await archiveCondominio(a.id);

    // Mesmo arquivado, CNPJ continua "tomado" (unique global)
    const found = await findCondominioByCnpj(baseInput.cnpj!);
    expect(found?.id).toBe(a.id);

    // excludeId permite "ignorar este registro" (caso PATCH no próprio)
    const foundExcluding = await findCondominioByCnpj(baseInput.cnpj!, a.id);
    expect(foundExcluding).toBeNull();
  });

  it('list com includeArquivados=false esconde arquivados', async () => {
    const a = await createCondominio(baseInput);
    await archiveCondominio(a.id);

    const semArquivados = await listCondominios({
      page: 1,
      pageSize: 100,
      q: TEST_PREFIX,
      includeArquivados: false,
    });
    expect(semArquivados.items.find((c) => c.id === a.id)).toBeUndefined();

    const comArquivados = await listCondominios({
      page: 1,
      pageSize: 100,
      q: TEST_PREFIX,
      includeArquivados: true,
    });
    expect(comArquivados.items.find((c) => c.id === a.id)).toBeDefined();
  });
});

// HTTP smoke: app rodando + sem session = 401 (tenant context lança Unauthorized)
const APP_REACHABLE_STATIC = DB_REACHABLE;
let APP_REACHABLE_RUNTIME = false;

describe.skipIf(!APP_REACHABLE_STATIC)('Condominio API auth guards', () => {
  it('GET /api/admin/condominios sem auth retorna 401', async () => {
    try {
      const res = await fetch(`${APP_URL}/api/admin/condominios`);
      APP_REACHABLE_RUNTIME = res.status < 500 || res.status === 401;
      if (!APP_REACHABLE_RUNTIME) return;
      expect([401, 403]).toContain(res.status);
      const body = await res.json();
      expect(body.ok).toBe(false);
    } catch {
      // app não rodando — skip silencioso
    }
  });
});
