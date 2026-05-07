/* @vitest-environment node */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { organizarPacote } from '@/lib/db/pacote-organizar';

const DB_REACHABLE =
  !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql://');
const setupDb = DB_REACHABLE
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  : null;

const TAG = `org-test-${Date.now()}`;
let condAId = '';
let userAId = '';
let unidadeAId = '';
let moradorAId = '';
let setorAId = '';
let setorOutroCondId = '';
let pacoteId = '';

beforeAll(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;

    const cond = await tx.condominio.create({
      data: {
        nome: `${TAG}-cond`,
        endereco: 'r',
        cep: '74650-100',
        cidade: 'GYN',
        estado: 'GO',
        contato_nome: 'X',
        contato_telefone: '+5511999999999',
      },
    });
    condAId = cond.id;

    const condB = await tx.condominio.create({
      data: {
        nome: `${TAG}-condB`,
        endereco: 'r',
        cep: '01000-000',
        cidade: 'SP',
        estado: 'SP',
        contato_nome: 'X',
        contato_telefone: '+5511988887777',
      },
    });

    const user = await tx.user.create({
      data: {
        clerk_id: `${TAG}-clerk`,
        email: `${TAG}@t.com`,
        nome: 'Porteiro',
        role: 'porteiro',
        condominio_id: condAId,
      },
    });
    userAId = user.id;

    const unidade = await tx.unidade.create({
      data: { condominio_id: condAId, identificador: '101', bloco: 'A' },
    });
    unidadeAId = unidade.id;

    const morador = await tx.morador.create({
      data: {
        condominio_id: condAId,
        unidade_id: unidadeAId,
        nome: 'João',
        nome_normalizado: 'joao',
        telefone: '+5511977776666',
        is_principal: true,
      },
    });
    moradorAId = morador.id;

    const setor = await tx.setor.create({
      data: { condominio_id: condAId, nome: 'Recepção' },
    });
    setorAId = setor.id;

    const setorOutro = await tx.setor.create({
      data: { condominio_id: condB.id, nome: 'Outro' },
    });
    setorOutroCondId = setorOutro.id;
  });
});

afterAll(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    await tx.pacoteEvento.deleteMany({ where: { condominio_id: condAId } });
    await tx.pacoteFoto.deleteMany({ where: { condominio_id: condAId } });
    await tx.pacote.deleteMany({ where: { condominio_id: condAId } });
    await tx.morador.deleteMany({ where: { condominio_id: condAId } });
    await tx.unidade.deleteMany({ where: { condominio_id: condAId } });
    await tx.setor.deleteMany({ where: { OR: [{ id: setorAId }, { id: setorOutroCondId }] } });
    await tx.user.deleteMany({ where: { clerk_id: `${TAG}-clerk` } });
    await tx.condominio.deleteMany({
      where: { OR: [{ id: condAId }, { nome: `${TAG}-condB` }] },
    });
  });
  await setupDb.$disconnect();
});

beforeEach(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    await tx.pacote.deleteMany({ where: { condominio_id: condAId } });

    const pacote = await tx.pacote.create({
      data: {
        condominio_id: condAId,
        status: 'rascunho',
        qr_token: `qr-${Date.now()}-${Math.random()}`,
        recebido_em: new Date(),
        funcionario_recebedor_id: userAId,
        unidade_id: unidadeAId,
        destinatario_id: moradorAId,
        destinatario_resolvido_via: 'destinatario_cadastrado',
      },
      select: { id: true },
    });
    pacoteId = pacote.id;
  });
});

const ctx = () => ({
  kind: 'tenant' as const,
  userId: userAId,
  condominioId: condAId,
  role: 'porteiro' as const,
});

describe.skipIf(!DB_REACHABLE)('organizarPacote (story 3.9)', () => {
  it('organiza com sucesso → status aguardando_retirada', async () => {
    const res = await organizarPacote(ctx(), pacoteId, {
      tamanho: 'medio',
      setor_id: setorAId,
      posicao: 'B-12',
    });
    expect(res.already_organized).toBe(false);
    expect(res.status).toBe('aguardando_retirada');

    const pacote = await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacote.findUnique({ where: { id: pacoteId } });
    });
    expect(pacote!.status).toBe('aguardando_retirada');
    expect(pacote!.tamanho).toBe('medio');
    expect(pacote!.setor_id).toBe(setorAId);
    expect(pacote!.posicao).toBe('B-12');
  });

  it('rejeita setor de outro tenant', async () => {
    await expect(
      organizarPacote(ctx(), pacoteId, {
        tamanho: 'medio',
        setor_id: setorOutroCondId,
        posicao: null,
      }),
    ).rejects.toThrow();
  });

  it('rejeita pacote sem unidade_id (não confirmado)', async () => {
    if (!setupDb) return;
    const naoConfirmado = await setupDb.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacote.create({
        data: {
          condominio_id: condAId,
          status: 'rascunho',
          qr_token: `qr-naoconf-${Date.now()}`,
          recebido_em: new Date(),
          funcionario_recebedor_id: userAId,
        },
        select: { id: true },
      });
    });
    await expect(
      organizarPacote(ctx(), naoConfirmado.id, {
        tamanho: 'medio',
        setor_id: setorAId,
        posicao: null,
      }),
    ).rejects.toThrow(/confirmado/);
  });

  it('idempotência: 2x mesmo payload retorna already_organized=true', async () => {
    await organizarPacote(ctx(), pacoteId, {
      tamanho: 'grande',
      setor_id: setorAId,
      posicao: 'A-1',
    });
    const r2 = await organizarPacote(ctx(), pacoteId, {
      tamanho: 'grande',
      setor_id: setorAId,
      posicao: 'A-1',
    });
    expect(r2.already_organized).toBe(true);
  });
});
