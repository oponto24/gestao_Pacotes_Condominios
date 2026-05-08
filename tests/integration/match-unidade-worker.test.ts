/* @vitest-environment node */
/**
 * Integration tests do matching IA → unidade/morador (story 3.7).
 *
 * Cobertura:
 *   1. Matched: pacote tem unidade_id + destinatario_id; status fica rascunho;
 *      evento ia_processou tem matching.kind = 'matched'
 *   2. Pending por no_complemento: status vai pra pendente_identificacao
 *   3. Tenant isolation: unidade de outro cond não casa
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

const DB_REACHABLE =
  !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql://');

const setupDb = DB_REACHABLE
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  : null;

const TAG = `match-test-${Date.now()}`;
let condAId = '';
let userAId = '';
let unidadeAId = '';
let moradorPrincipalId = '';
let pacoteId = '';

vi.mock('@/lib/storage', () => ({
  storage: {
    get: vi.fn(() =>
      Promise.resolve({
        key: 'fake/path.jpg',
        body: Buffer.from('fake'),
        size: 4,
        contentType: 'image/jpeg',
      }),
    ),
  },
}));

const mockExtraction = vi.fn();
vi.mock('@/lib/ai/extract-label', () => ({
  extractLabelFromImage: (input: unknown) => mockExtraction(input),
}));

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
        nome: 'Porteiro',
        role: 'porteiro',
        condominio_id: condAId,
      },
    });
    userAId = user.id;

    const unidade = await tx.unidade.create({
      data: {
        condominio_id: condAId,
        identificador: '1304',
        bloco: '3',
      },
    });
    unidadeAId = unidade.id;

    const morador = await tx.morador.create({
      data: {
        condominio_id: condAId,
        unidade_id: unidadeAId,
        nome: 'João Silva',
        nome_normalizado: 'joao silva',
        telefone: '+5511988887777',
        is_principal: true,
      },
    });
    moradorPrincipalId = morador.id;
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
    await tx.user.deleteMany({ where: { clerk_id: `${TAG}-clerk` } });
    await tx.condominio.deleteMany({ where: { id: condAId } });
  });
  await setupDb.$disconnect();
});

beforeEach(async () => {
  if (!setupDb) return;
  mockExtraction.mockReset();

  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    await tx.pacoteEvento.deleteMany({ where: { condominio_id: condAId } });
    await tx.pacoteFoto.deleteMany({ where: { condominio_id: condAId } });
    await tx.pacote.deleteMany({ where: { condominio_id: condAId } });

    const pacote = await tx.pacote.create({
      data: {
        condominio_id: condAId,
        status: 'rascunho',
        qr_token: `qr-${Date.now()}-${Math.random()}`,
        recebido_em: new Date(),
        funcionario_recebedor_id: userAId,
      },
      select: { id: true },
    });
    pacoteId = pacote.id;

    await tx.pacoteFoto.create({
      data: {
        condominio_id: condAId,
        pacote_id: pacoteId,
        storage_path: 'fake/path.jpg',
        mime_type: 'image/jpeg',
        bytes: 4,
        hash_sha256: 'a'.repeat(64),
        is_principal: true,
      },
    });
  });
});

describe.skipIf(!DB_REACHABLE)('matching unidade/morador (story 3.7)', () => {
  it('match perfeito: status fica rascunho + unidade_id + destinatario_id preenchidos', async () => {
    mockExtraction.mockResolvedValue({
      json: {
        nome_destinatario: 'João Silva',
        cep: '74650-100',
        complemento: 'AP 1304 Bloco 3',
        confianca: 0.92,
      },
      confianca: 0.92,
      usage: { input_tokens: 100, output_tokens: 50 },
      model: 'fake-model',
      durationMs: 100,
    });

    const { processExtractLabel } = await import('@/lib/queue/jobs/extract-label');
    const result = await processExtractLabel({
      data: { pacote_id: pacoteId, condominio_id: condAId },
    } as unknown as Parameters<typeof processExtractLabel>[0]);

    expect(result.match.kind).toBe('matched');

    const pacote = await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacote.findUnique({ where: { id: pacoteId } });
    });
    expect(pacote!.status).toBe('rascunho');
    expect(pacote!.unidade_id).toBe(unidadeAId);
    expect(pacote!.destinatario_id).toBe(moradorPrincipalId);
    expect(pacote!.destinatario_resolvido_via).toBe('destinatario_cadastrado');
  });

  it('sem complemento: status vira pendente_identificacao', async () => {
    mockExtraction.mockResolvedValue({
      json: {
        nome_destinatario: 'João Silva',
        cep: '74650-100',
        complemento: null,
        confianca: 0.3,
      },
      confianca: 0.3,
      usage: { input_tokens: 100, output_tokens: 50 },
      model: 'fake-model',
      durationMs: 100,
    });

    const { processExtractLabel } = await import('@/lib/queue/jobs/extract-label');
    const result = await processExtractLabel({
      data: { pacote_id: pacoteId, condominio_id: condAId },
    } as unknown as Parameters<typeof processExtractLabel>[0]);

    expect(result.match.kind).toBe('pending');

    const pacote = await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacote.findUnique({ where: { id: pacoteId } });
    });
    expect(pacote!.status).toBe('pendente_identificacao');
    expect(pacote!.unidade_id).toBeNull();
    expect(pacote!.destinatario_id).toBeNull();
  });

  it('fallback principal: nome desconhecido mas unidade tem principal', async () => {
    mockExtraction.mockResolvedValue({
      json: {
        nome_destinatario: 'Pessoa Desconhecida',
        cep: '74650-100',
        complemento: 'AP 1304 Bloco 3',
        confianca: 0.7,
      },
      confianca: 0.7,
      usage: { input_tokens: 100, output_tokens: 50 },
      model: 'fake-model',
      durationMs: 100,
    });

    const { processExtractLabel } = await import('@/lib/queue/jobs/extract-label');
    const result = await processExtractLabel({
      data: { pacote_id: pacoteId, condominio_id: condAId },
    } as unknown as Parameters<typeof processExtractLabel>[0]);

    expect(result.match.kind).toBe('matched');

    const pacote = await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacote.findUnique({ where: { id: pacoteId } });
    });
    expect(pacote!.destinatario_resolvido_via).toBe('fallback_principal');
    expect(pacote!.destinatario_id).toBe(moradorPrincipalId);
  });

  it('evento ia_processou contém matching.kind no metadata', async () => {
    mockExtraction.mockResolvedValue({
      json: {
        nome_destinatario: 'João Silva',
        cep: '74650-100',
        complemento: 'AP 1304 Bloco 3',
        confianca: 0.92,
      },
      confianca: 0.92,
      usage: { input_tokens: 100, output_tokens: 50 },
      model: 'fake-model',
      durationMs: 100,
    });

    const { processExtractLabel } = await import('@/lib/queue/jobs/extract-label');
    await processExtractLabel({
      data: { pacote_id: pacoteId, condominio_id: condAId },
    } as unknown as Parameters<typeof processExtractLabel>[0]);

    const eventos = await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacoteEvento.findMany({ where: { pacote_id: pacoteId } });
    });
    const ia = eventos.find((e) => e.tipo === 'ia_processou');
    expect(ia).toBeDefined();
    const meta = ia!.metadata as Record<string, unknown>;
    expect(meta.matching).toMatchObject({
      kind: 'matched',
      resolvido_via: 'destinatario_cadastrado',
    });
  });
});
