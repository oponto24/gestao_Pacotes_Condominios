/* @vitest-environment node */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { listPacotesAdmin } from '@/lib/db/pacote-admin-list';
import { loadPacoteDetail } from '@/lib/db/pacote-admin-detail';

const DB_REACHABLE =
  !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql://');
const setupDb = DB_REACHABLE
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  : null;

const TAG = `admin-test-${Date.now()}`;
let condAId = '';
let condBId = '';
let userAId = '';
let unidadeAId = '';

beforeAll(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    const a = await tx.condominio.create({
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
    condAId = a.id;
    const b = await tx.condominio.create({
      data: {
        nome: `${TAG}-B`,
        endereco: 'r',
        cep: '01000-000',
        cidade: 'SP',
        estado: 'SP',
        contato_nome: 'Y',
        contato_telefone: '+5511988887777',
      },
    });
    condBId = b.id;
    const user = await tx.user.create({
      data: {
        clerk_id: `${TAG}-clerk`,
        email: `${TAG}@t.com`,
        nome: 'Admin',
        role: 'admin',
        condominio_id: condAId,
      },
    });
    userAId = user.id;
    const unidade = await tx.unidade.create({
      data: { condominio_id: condAId, identificador: '1304', bloco: '3' },
    });
    unidadeAId = unidade.id;
  });
});

afterAll(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    await tx.pacoteEvento.deleteMany({
      where: { OR: [{ condominio_id: condAId }, { condominio_id: condBId }] },
    });
    await tx.pacote.deleteMany({
      where: { OR: [{ condominio_id: condAId }, { condominio_id: condBId }] },
    });
    await tx.unidade.deleteMany({ where: { condominio_id: condAId } });
    await tx.user.deleteMany({ where: { clerk_id: `${TAG}-clerk` } });
    await tx.condominio.deleteMany({ where: { OR: [{ id: condAId }, { id: condBId }] } });
  });
  await setupDb.$disconnect();
});

beforeEach(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    await tx.pacoteEvento.deleteMany({
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
  role: 'admin' as const,
});

async function createPacote(condId: string, data: Record<string, unknown>) {
  return setupDb!.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    const p = await tx.pacote.create({
      data: {
        condominio_id: condId,
        status: 'rascunho',
        qr_token: `tk-${Math.random()}`,
        recebido_em: new Date(),
        ...data,
      } as never,
      select: { id: true },
    });
    return p.id;
  });
}

describe.skipIf(!DB_REACHABLE)('listPacotesAdmin (6.1 + 6.2)', () => {
  it('lista pacotes do tenant', async () => {
    await createPacote(condAId, { nome_destinatario_etiqueta: 'João' });
    await createPacote(condAId, { nome_destinatario_etiqueta: 'Maria' });
    await createPacote(condBId, { nome_destinatario_etiqueta: 'Bob' });

    const r = await listPacotesAdmin(ctx(), {});
    expect(r.total).toBe(2);
    expect(r.items.every((p) => p.nome_destinatario_etiqueta !== 'Bob')).toBe(true);
  });

  it('filtra por status', async () => {
    await createPacote(condAId, {
      nome_destinatario_etiqueta: 'A',
      status: 'rascunho',
    });
    await createPacote(condAId, {
      nome_destinatario_etiqueta: 'B',
      status: 'aguardando_retirada',
    });
    const r = await listPacotesAdmin(ctx(), { status: 'aguardando_retirada' });
    expect(r.total).toBe(1);
    expect(r.items[0]!.nome_destinatario_etiqueta).toBe('B');
  });

  it('busca textual q por nome', async () => {
    await createPacote(condAId, { nome_destinatario_etiqueta: 'João Silva' });
    await createPacote(condAId, { nome_destinatario_etiqueta: 'Maria Costa' });
    const r = await listPacotesAdmin(ctx(), { q: 'silva' });
    expect(r.total).toBe(1);
    expect(r.items[0]!.nome_destinatario_etiqueta).toBe('João Silva');
  });

  it('busca textual q por unidade.identificador', async () => {
    await createPacote(condAId, {
      nome_destinatario_etiqueta: 'C',
      unidade_id: unidadeAId,
    });
    const r = await listPacotesAdmin(ctx(), { q: '1304' });
    expect(r.total).toBe(1);
  });

  it('q < 2 chars é ignorado', async () => {
    await createPacote(condAId, { nome_destinatario_etiqueta: 'X' });
    const r = await listPacotesAdmin(ctx(), { q: 'a' });
    expect(r.total).toBe(1);
  });
});

describe.skipIf(!DB_REACHABLE)('loadPacoteDetail (6.3)', () => {
  it('carrega pacote + eventos', async () => {
    const id = await createPacote(condAId, {
      nome_destinatario_etiqueta: 'João',
      unidade_id: unidadeAId,
    });
    await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      await tx.pacoteEvento.create({
        data: {
          condominio_id: condAId,
          pacote_id: id,
          tipo: 'criado',
          user_id: userAId,
          metadata: { foo: 'bar' },
        },
      });
    });

    const detail = await loadPacoteDetail(ctx(), id);
    expect(detail).not.toBeNull();
    expect(detail!.nome_destinatario_etiqueta).toBe('João');
    expect(detail!.eventos).toHaveLength(1);
    expect(detail!.eventos[0]!.user_nome).toBe('Admin');
  });

  it('null para pacote de outro tenant', async () => {
    const id = await createPacote(condBId, { nome_destinatario_etiqueta: 'X' });
    const detail = await loadPacoteDetail(ctx(), id);
    expect(detail).toBeNull();
  });
});
