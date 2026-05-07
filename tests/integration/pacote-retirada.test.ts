/* @vitest-environment node */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  loadPacoteByQrToken,
  confirmarRetirada,
} from '@/lib/db/pacote-retirada';

const DB_REACHABLE =
  !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql://');
const setupDb = DB_REACHABLE
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  : null;

const TAG = `ret-test-${Date.now()}`;
let condAId = '';
let userAId = '';
let unidadeAId = '';
let moradorAId = '';
let setorAId = '';

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
    const unidade = await tx.unidade.create({
      data: { condominio_id: condAId, identificador: '101', bloco: 'A' },
    });
    unidadeAId = unidade.id;
    const morador = await tx.morador.create({
      data: {
        condominio_id: condAId,
        unidade_id: unidadeAId,
        nome: 'João Silva',
        nome_normalizado: 'joao silva',
        telefone: '+5511966665555',
        is_principal: true,
      },
    });
    moradorAId = morador.id;
    const setor = await tx.setor.create({
      data: { condominio_id: condAId, nome: 'Recepção' },
    });
    setorAId = setor.id;
  });
});

afterAll(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    await tx.pacoteEvento.deleteMany({ where: { condominio_id: condAId } });
    await tx.pacote.deleteMany({ where: { condominio_id: condAId } });
    await tx.morador.deleteMany({ where: { condominio_id: condAId } });
    await tx.unidade.deleteMany({ where: { condominio_id: condAId } });
    await tx.setor.deleteMany({ where: { id: setorAId } });
    await tx.user.deleteMany({ where: { clerk_id: `${TAG}-clerk` } });
    await tx.condominio.deleteMany({ where: { id: condAId } });
  });
  await setupDb.$disconnect();
});

const ctx = () => ({
  kind: 'tenant' as const,
  userId: userAId,
  condominioId: condAId,
  role: 'porteiro' as const,
});

async function createPacoteAguardando(token: string) {
  return setupDb!.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    const p = await tx.pacote.create({
      data: {
        condominio_id: condAId,
        status: 'aguardando_retirada',
        qr_token: token,
        recebido_em: new Date(),
        funcionario_recebedor_id: userAId,
        unidade_id: unidadeAId,
        destinatario_id: moradorAId,
        destinatario_resolvido_via: 'destinatario_cadastrado',
        tamanho: 'medio',
        setor_id: setorAId,
        posicao: 'B-12',
        nome_destinatario_etiqueta: 'João Silva',
      },
      select: { id: true },
    });
    return p.id;
  });
}

beforeEach(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    await tx.pacoteEvento.deleteMany({ where: { condominio_id: condAId } });
    await tx.pacote.deleteMany({ where: { condominio_id: condAId } });
  });
});

describe.skipIf(!DB_REACHABLE)('loadPacoteByQrToken (5.2)', () => {
  it('retorna pacote em aguardando_retirada', async () => {
    const token = `tk-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    await createPacoteAguardando(token);

    const r = await loadPacoteByQrToken(ctx(), token);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pacote.unidade?.identificador).toBe('101');
      expect(r.pacote.destinatario?.nome).toBe('João Silva');
      expect(r.pacote.setor?.nome).toBe('Recepção');
    }
  });

  it('not_found para token inexistente', async () => {
    const r = await loadPacoteByQrToken(ctx(), 'tk-naoexiste-1234567890');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('already_retirado se qr_consumido_em setado', async () => {
    const token = `tk-${Date.now()}-consumed`;
    const id = await createPacoteAguardando(token);
    await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      await tx.pacote.update({
        where: { id },
        data: { status: 'retirado', qr_consumido_em: new Date() },
      });
    });
    const r = await loadPacoteByQrToken(ctx(), token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('already_retirado');
  });
});

describe.skipIf(!DB_REACHABLE)('confirmarRetirada (5.4)', () => {
  it('próprio destinatário → retirado_por_morador_id setado', async () => {
    const token = `tk-${Date.now()}-proprio`;
    const id = await createPacoteAguardando(token);
    const r = await confirmarRetirada(ctx(), id, {
      proprio_destinatario: true,
      retirado_por_terceiro: null,
    });
    expect(r.already_retirado).toBe(false);

    const pacote = await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacote.findUnique({ where: { id } });
    });
    expect(pacote!.status).toBe('retirado');
    expect(pacote!.qr_consumido_em).toBeInstanceOf(Date);
    expect(pacote!.retirado_em).toBeInstanceOf(Date);
    expect(pacote!.retirado_por_morador_id).toBe(moradorAId);
    expect(pacote!.retirado_por_terceiro).toBeNull();
    expect(pacote!.funcionario_entregador_id).toBe(userAId);
  });

  it('terceiro → retirado_por_terceiro setado, morador_id null', async () => {
    const token = `tk-${Date.now()}-terceiro`;
    const id = await createPacoteAguardando(token);
    await confirmarRetirada(ctx(), id, {
      proprio_destinatario: false,
      retirado_por_terceiro: 'Maria Vizinha',
    });

    const pacote = await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacote.findUnique({ where: { id } });
    });
    expect(pacote!.retirado_por_morador_id).toBeNull();
    expect(pacote!.retirado_por_terceiro).toBe('Maria Vizinha');
  });

  it('cria evento retirado com metadata', async () => {
    const token = `tk-${Date.now()}-evento`;
    const id = await createPacoteAguardando(token);
    await confirmarRetirada(ctx(), id, {
      proprio_destinatario: true,
      retirado_por_terceiro: null,
    });
    const eventos = await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacoteEvento.findMany({ where: { pacote_id: id } });
    });
    const ev = eventos.find((e) => e.tipo === 'retirado');
    expect(ev).toBeDefined();
    expect(ev!.metadata).toMatchObject({ proprio_destinatario: true });
  });

  it('idempotência: já retirado retorna already_retirado=true', async () => {
    const token = `tk-${Date.now()}-idem`;
    const id = await createPacoteAguardando(token);
    await confirmarRetirada(ctx(), id, {
      proprio_destinatario: true,
      retirado_por_terceiro: null,
    });
    const r2 = await confirmarRetirada(ctx(), id, {
      proprio_destinatario: true,
      retirado_por_terceiro: null,
    });
    expect(r2.already_retirado).toBe(true);
  });

  it('rejeita pacote em rascunho', async () => {
    if (!setupDb) return;
    const id = await setupDb.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      const p = await tx.pacote.create({
        data: {
          condominio_id: condAId,
          status: 'rascunho',
          qr_token: `tk-${Date.now()}-rascunho`,
          recebido_em: new Date(),
        },
        select: { id: true },
      });
      return p.id;
    });
    await expect(
      confirmarRetirada(ctx(), id, {
        proprio_destinatario: true,
        retirado_por_terceiro: null,
      }),
    ).rejects.toThrow();
  });
});
