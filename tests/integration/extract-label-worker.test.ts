/* @vitest-environment node */
/**
 * Tests integration de processExtractLabel (story 3.5).
 *
 * Mock do Anthropic SDK para evitar custo real + flakiness.
 * Foca:
 *   1. Pacote rascunho criado → worker processa → ia_extracao_raw + ia_confianca + ia_processada_em preenchidos
 *   2. Evento `ia_processou` registrado com metadata (incluindo telemetria de tokens)
 *   3. Tenant isolation via filtro condominio_id no payload
 *   4. Erro do schema → continua com confianca=0 + raw error
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

const DB_REACHABLE =
  !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql://');

const setupDb = DB_REACHABLE
  ? new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  : null;

const TAG = `extract-label-test-${Date.now()}`;
let condAId = '';
let pacoteAId = '';
let userAId = '';

const baseFixture = {
  endereco: 'r',
  cep: '1',
  cidade: 'SP',
  estado: 'SP',
  contato_nome: 'X',
  contato_telefone: '+5511999999999',
};

// Mock storage.get para retornar buffer fake (não acessa disco real)
vi.mock('@/lib/storage', () => ({
  storage: {
    get: vi.fn(() =>
      Promise.resolve({
        key: 'fake/path.jpg',
        body: Buffer.from('fake-jpeg-bytes'),
        size: 16,
        contentType: 'image/jpeg',
      }),
    ),
  },
}));

// Mock Anthropic — controlado via fnRef
const mockExtraction = vi.fn();
vi.mock('@/lib/anthropic/extract-label', () => ({
  extractLabelFromImage: (input: unknown) => mockExtraction(input),
}));

beforeAll(async () => {
  if (!setupDb) return;
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
    const a = await tx.condominio.create({ data: { nome: `${TAG}-A`, ...baseFixture } });
    condAId = a.id;

    const user = await tx.user.create({
      data: {
        clerk_id: `${TAG}-clerk`,
        email: `${TAG}@test.com`,
        nome: 'Test Porteiro',
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
    await tx.pacoteEvento.deleteMany({ where: { condominio_id: condAId } });
    await tx.pacoteFoto.deleteMany({ where: { condominio_id: condAId } });
    await tx.pacote.deleteMany({ where: { condominio_id: condAId } });
    await tx.user.deleteMany({ where: { clerk_id: `${TAG}-clerk` } });
    await tx.condominio.deleteMany({ where: { id: condAId } });
  });
  await setupDb.$disconnect();
});

beforeEach(async () => {
  if (!setupDb) return;
  mockExtraction.mockReset();

  // Cria pacote fresco antes de cada test
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;

    // Limpa pacotes anteriores
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
    pacoteAId = pacote.id;

    await tx.pacoteFoto.create({
      data: {
        condominio_id: condAId,
        pacote_id: pacoteAId,
        storage_path: 'fake/path.jpg',
        mime_type: 'image/jpeg',
        bytes: 16,
        hash_sha256: 'a'.repeat(64),
        is_principal: true,
      },
    });
  });
});

describe.skipIf(!DB_REACHABLE)('processExtractLabel (worker)', () => {
  it('processa pacote rascunho → atualiza ia_extracao_raw + ia_confianca + ia_processada_em', async () => {
    mockExtraction.mockResolvedValue({
      json: {
        nome_destinatario: 'Maria Silva',
        endereco: 'Rua das Flores, 123',
        cep: '74650-100',
        complemento: 'AP 1304',
        transportadora: 'correios',
        remetente: 'Loja XYZ',
        confianca: 0.92,
      },
      confianca: 0.92,
      usage: {
        input_tokens: 1500,
        output_tokens: 200,
        cache_creation_input_tokens: 1500,
        cache_read_input_tokens: 0,
      },
      model: 'claude-haiku-4-5-20251001',
      durationMs: 2300,
    });

    const { processExtractLabel } = await import('@/lib/queue/jobs/extract-label');
    const result = await processExtractLabel({
      data: { pacote_id: pacoteAId, condominio_id: condAId },
    } as unknown as Parameters<typeof processExtractLabel>[0]);

    expect(result.confianca).toBe(0.92);
    expect(result.pacote_id).toBe(pacoteAId);

    // Verifica estado do DB
    const pacote = await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacote.findUnique({ where: { id: pacoteAId } });
    });
    expect(pacote!.ia_confianca).not.toBeNull();
    expect(Number(pacote!.ia_confianca)).toBeCloseTo(0.92, 2);
    expect(pacote!.ia_processada_em).toBeInstanceOf(Date);
    expect(pacote!.ia_extracao_raw).toMatchObject({
      nome_destinatario: 'Maria Silva',
      transportadora: 'correios',
    });
    // Story 3.7: sem unidade cadastrada no fixture, matching falha →
    // status vira pendente_identificacao (FR-021).
    expect(pacote!.status).toBe('pendente_identificacao');
  });

  it('cria evento ia_processou com telemetria de tokens', async () => {
    mockExtraction.mockResolvedValue({
      json: { confianca: 0.5 },
      confianca: 0.5,
      usage: {
        input_tokens: 1500,
        output_tokens: 200,
        cache_creation_input_tokens: 1500,
        cache_read_input_tokens: 0,
      },
      model: 'claude-haiku-4-5-20251001',
      durationMs: 1800,
    });

    const { processExtractLabel } = await import('@/lib/queue/jobs/extract-label');
    await processExtractLabel({
      data: { pacote_id: pacoteAId, condominio_id: condAId },
    } as unknown as Parameters<typeof processExtractLabel>[0]);

    const eventos = await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacoteEvento.findMany({ where: { pacote_id: pacoteAId } });
    });
    const ia = eventos.find((e) => e.tipo === 'ia_processou');
    expect(ia).toBeDefined();
    expect(ia!.metadata).toMatchObject({
      confianca: 0.5,
      model: 'claude-haiku-4-5-20251001',
      input_tokens: 1500,
      output_tokens: 200,
    });
  });

  it('falha graceful do schema: persiste ia_extracao_raw com error + confianca=0', async () => {
    mockExtraction.mockResolvedValue({
      json: { error: 'invalid_json_from_ia', raw_text: '<html>error</html>' },
      confianca: 0,
      usage: { input_tokens: 1000, output_tokens: 50 },
      model: 'claude-haiku-4-5-20251001',
      durationMs: 1000,
    });

    const { processExtractLabel } = await import('@/lib/queue/jobs/extract-label');
    const result = await processExtractLabel({
      data: { pacote_id: pacoteAId, condominio_id: condAId },
    } as unknown as Parameters<typeof processExtractLabel>[0]);

    expect(result.confianca).toBe(0);

    const pacote = await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacote.findUnique({ where: { id: pacoteAId } });
    });
    expect(Number(pacote!.ia_confianca)).toBe(0);
    expect(pacote!.ia_extracao_raw).toMatchObject({
      error: 'invalid_json_from_ia',
    });
  });

  it('rejeita pacote de outro condomínio (tenant isolation)', async () => {
    mockExtraction.mockResolvedValue({
      json: { confianca: 0.9 },
      confianca: 0.9,
      usage: { input_tokens: 1, output_tokens: 1 },
      model: 'fake',
      durationMs: 1,
    });

    const { processExtractLabel } = await import('@/lib/queue/jobs/extract-label');
    await expect(
      processExtractLabel({
        data: { pacote_id: pacoteAId, condominio_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      } as unknown as Parameters<typeof processExtractLabel>[0]),
    ).rejects.toThrow(/não encontrado/);
  });

  it('throw quando Anthropic falha (retry BullMQ)', async () => {
    mockExtraction.mockRejectedValue(new Error('Rate limit exceeded'));

    const { processExtractLabel } = await import('@/lib/queue/jobs/extract-label');
    await expect(
      processExtractLabel({
        data: { pacote_id: pacoteAId, condominio_id: condAId },
      } as unknown as Parameters<typeof processExtractLabel>[0]),
    ).rejects.toThrow(/Rate limit/);

    // Pacote NÃO foi atualizado
    const pacote = await setupDb!.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.pacote.findUnique({ where: { id: pacoteAId } });
    });
    expect(pacote!.ia_confianca).toBeNull();
    expect(pacote!.ia_processada_em).toBeNull();
  });
});
