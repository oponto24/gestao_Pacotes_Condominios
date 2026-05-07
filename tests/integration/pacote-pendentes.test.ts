/* @vitest-environment node */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { listPendentes } from '@/lib/db/pacote-pendentes';

const DB_REACHABLE =
  !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql://');
const setupDb = DB_REACHABLE
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  : null;

const TAG = `pend-test-${Date.now()}`;
let condAId = '';
let condBId = '';
let userAId = '';

beforeAll(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;

    const condA = await tx.condominio.create({
      data: {
        nome: `${TAG}-A`,
        endereco: 'r',
        cep: '74650-100',
        cidade: 'GYN',
        estado: 'GO',
        contato_nome: 'X',
        contato_telefone: '+5511999999999',
      },
    });
    condAId = condA.id;
    const condB = await tx.condominio.create({
      data: {
        nome: `${TAG}-B`,
        endereco: 'r',
        cep: '01000-000',
        cidade: 'SP',
        estado: 'SP',
        contato_nome: 'X',
        contato_telefone: '+5511988887777',
      },
    });
    condBId = condB.id;

    const user = await tx.user.create({
      data: {
        clerk_id: `${TAG}-clerk`,
        email: `${TAG}@t.com`,
        nome: 'P',
        role: 'porteiro',
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
    await tx.pacoteFoto.deleteMany({
      where: { OR: [{ condominio_id: condAId }, { condominio_id: condBId }] },
    });
    await tx.pacote.deleteMany({
      where: { OR: [{ condominio_id: condAId }, { condominio_id: condBId }] },
    });
    await tx.user.deleteMany({ where: { clerk_id: `${TAG}-clerk` } });
    await tx.condominio.deleteMany({
      where: { OR: [{ id: condAId }, { id: condBId }] },
    });
  });
  await setupDb.$disconnect();
});

beforeEach(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    await tx.pacoteFoto.deleteMany({
      where: { OR: [{ condominio_id: condAId }, { condominio_id: condBId }] },
    });
    await tx.pacote.deleteMany({
      where: { OR: [{ condominio_id: condAId }, { condominio_id: condBId }] },
    });
  });
});

const ctx = () => ({
  kind: 'tenant' as const,
  userId: userAId,
  condominioId: condAId,
  role: 'porteiro' as const,
});

async function createPacote(condId: string, status: string, nome: string) {
  return setupDb!.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    const p = await tx.pacote.create({
      data: {
        condominio_id: condId,
        status: status as 'rascunho' | 'pendente_identificacao' | 'aguardando_retirada',
        qr_token: `qr-${Math.random()}`,
        recebido_em: new Date(),
        nome_destinatario_etiqueta: nome,
      },
      select: { id: true },
    });
    await tx.pacoteFoto.create({
      data: {
        condominio_id: condId,
        pacote_id: p.id,
        storage_path: `fake/${p.id}.jpg`,
        mime_type: 'image/jpeg',
        bytes: 100,
        hash_sha256: 'a'.repeat(64),
        is_principal: true,
      },
    });
    return p.id;
  });
}

describe.skipIf(!DB_REACHABLE)('listPendentes (story 3.10)', () => {
  it('retorna apenas pacotes em pendente_identificacao do tenant', async () => {
    await createPacote(condAId, 'pendente_identificacao', 'Pendente A1');
    await createPacote(condAId, 'rascunho', 'Rascunho A2');
    await createPacote(condAId, 'aguardando_retirada', 'Aguardando A3');
    await createPacote(condBId, 'pendente_identificacao', 'Pendente B1');

    const itens = await listPendentes(ctx());
    expect(itens).toHaveLength(1);
    expect(itens[0]!.nome_destinatario_etiqueta).toBe('Pendente A1');
  });

  it('retorna lista vazia quando não há pendentes', async () => {
    await createPacote(condAId, 'rascunho', 'X');
    const itens = await listPendentes(ctx());
    expect(itens).toEqual([]);
  });

  it('inclui foto_storage_path quando há foto principal', async () => {
    await createPacote(condAId, 'pendente_identificacao', 'Com foto');
    const itens = await listPendentes(ctx());
    expect(itens[0]!.foto_storage_path).toMatch(/\.jpg$/);
  });
});
