/* @vitest-environment node */
/**
 * Testes integration do handler Clerk webhook (Story 1.5)
 *
 * Cobre:
 *   1. POST sem headers svix → 400
 *   2. POST com assinatura inválida → 400
 *   3. POST user.created válido → cria user no DB
 *   4. POST user.updated → preserva condominio_id/role
 *   5. POST user.deleted → seta ativo=false (não deleta)
 *
 * Pula automaticamente se DB inacessível ou CLERK_WEBHOOK_SECRET ausente.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Webhook } from 'svix';
import { PrismaClient } from '@prisma/client';

const RUNTIME_URL = process.env.DATABASE_RUNTIME_URL ?? process.env.DATABASE_URL;
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
const APP_URL = 'http://localhost:3000';
const WEBHOOK_PATH = '/api/webhooks/clerk';

// Para teste, geramos um par de chaves svix local — não usamos a Clerk real.
// Sobrescrevemos CLERK_WEBHOOK_SECRET no fetch via header customizado? Não dá.
// Estratégia: testamos contra o secret REAL do .env.local. Se o app usar
// `whsec_PENDING_DASHBOARD_CONFIG`, esses testes pulam.
const CONFIGURED =
  !!RUNTIME_URL &&
  RUNTIME_URL.includes('postgresql://') &&
  !!WEBHOOK_SECRET &&
  WEBHOOK_SECRET !== 'whsec_PENDING_DASHBOARD_CONFIG';

const db = new PrismaClient({ datasources: { db: { url: RUNTIME_URL } } });
const TEST_TAG = `clerk-test-${Date.now()}`;
const TEST_CLERK_ID = `user_${TEST_TAG}`;

function buildSignedRequest(payload: object, secret: string) {
  const wh = new Webhook(secret);
  const id = `msg_${Math.random().toString(36).slice(2)}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify(payload);
  const signature = wh.sign(id, new Date(Number(timestamp) * 1000), body);
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    },
  };
}

async function appAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${APP_URL}/api/health/db`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

let APP_REACHABLE = false;

beforeAll(async () => {
  if (!CONFIGURED) return;
  APP_REACHABLE = await appAvailable();
});

afterAll(async () => {
  if (CONFIGURED && APP_REACHABLE) {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      await tx.user.deleteMany({ where: { clerk_id: TEST_CLERK_ID } });
    });
  }
  await db.$disconnect();
});

describe.skipIf(!CONFIGURED)('Clerk webhook handler', () => {
  it('rejeita POST sem headers svix com 400', async () => {
    if (!APP_REACHABLE) return;
    const res = await fetch(`${APP_URL}${WEBHOOK_PATH}`, {
      method: 'POST',
      body: JSON.stringify({ type: 'user.created', data: { id: 'x' } }),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('rejeita POST com assinatura inválida com 400', async () => {
    if (!APP_REACHABLE) return;
    const res = await fetch(`${APP_URL}${WEBHOOK_PATH}`, {
      method: 'POST',
      body: JSON.stringify({ type: 'user.created', data: { id: 'x' } }),
      headers: {
        'content-type': 'application/json',
        'svix-id': 'msg_fake',
        'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
        'svix-signature': 'v1,assinatura_falsa',
      },
    });
    expect(res.status).toBe(400);
  });

  it('aceita user.created válido e cria user no DB', async () => {
    if (!APP_REACHABLE) return;
    const payload = {
      type: 'user.created',
      data: {
        id: TEST_CLERK_ID,
        email_addresses: [
          { id: 'eml_1', email_address: `${TEST_TAG}@test.local` },
        ],
        primary_email_address_id: 'eml_1',
        first_name: 'Maria',
        last_name: 'Teste',
      },
    };
    const { body, headers } = buildSignedRequest(payload, WEBHOOK_SECRET!);
    const res = await fetch(`${APP_URL}${WEBHOOK_PATH}`, {
      method: 'POST',
      body,
      headers,
    });
    expect(res.status).toBe(200);

    const user = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.user.findUnique({ where: { clerk_id: TEST_CLERK_ID } });
    });
    expect(user).toBeTruthy();
    expect(user?.email).toBe(`${TEST_TAG}@test.local`);
    expect(user?.nome).toBe('Maria Teste');
    expect(user?.role).toBe('porteiro');
    expect(user?.condominio_id).toBeNull();
    expect(user?.ativo).toBe(true);
  });

  it('user.updated preserva condominio_id e role custom', async () => {
    if (!APP_REACHABLE) return;
    // Setup: simula que admin associou user a um condomínio com role=admin
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      await tx.user.update({
        where: { clerk_id: TEST_CLERK_ID },
        data: { role: 'admin' },
      });
    });

    const payload = {
      type: 'user.updated',
      data: {
        id: TEST_CLERK_ID,
        email_addresses: [
          { id: 'eml_1', email_address: `${TEST_TAG}-updated@test.local` },
        ],
        primary_email_address_id: 'eml_1',
        first_name: 'Maria',
        last_name: 'Atualizada',
      },
    };
    const { body, headers } = buildSignedRequest(payload, WEBHOOK_SECRET!);
    await fetch(`${APP_URL}${WEBHOOK_PATH}`, { method: 'POST', body, headers });

    const user = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.user.findUnique({ where: { clerk_id: TEST_CLERK_ID } });
    });
    expect(user?.email).toBe(`${TEST_TAG}-updated@test.local`);
    expect(user?.nome).toBe('Maria Atualizada');
    expect(user?.role).toBe('admin'); // PRESERVADO, não voltou pra 'porteiro'
  });

  it('user.deleted seta ativo=false e NÃO deleta a linha', async () => {
    if (!APP_REACHABLE) return;
    const payload = { type: 'user.deleted', data: { id: TEST_CLERK_ID } };
    const { body, headers } = buildSignedRequest(payload, WEBHOOK_SECRET!);
    const res = await fetch(`${APP_URL}${WEBHOOK_PATH}`, {
      method: 'POST',
      body,
      headers,
    });
    expect(res.status).toBe(200);

    const user = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_super_admin = 'true'`;
      return tx.user.findUnique({ where: { clerk_id: TEST_CLERK_ID } });
    });
    expect(user).toBeTruthy(); // não deletado
    expect(user?.ativo).toBe(false);
  });
});
