/* @vitest-environment node */
/**
 * Testes integration do seed (story 1.10).
 *
 * Roda contra Postgres real (DATABASE_URL = SUPERUSER, mesmo do seed.ts).
 * Pula se DB não acessível (CI sem Docker).
 *
 * Cada teste limpa User/WhatsAppNumber antes para garantir isolamento.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const DB_REACHABLE =
  !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql://');

const SEED_EMAIL = 'seed-test@example.com';
const SEED_EMAIL_ALT = 'seed-test-alt@example.com';
const PLACEHOLDER_PHONE_ID = 'PLACEHOLDER_META_PHONE_NUMBER_ID';

// Mesma lógica do seed.ts:pendingClerkIdFor — duplicada aqui pra evitar import
// transitivo de Prisma client com path alias `@/`.
function expectedPendingClerkId(email: string): string {
  return `pending_clerk_link_${crypto.createHash('sha256').update(email).digest('hex').slice(0, 16)}`;
}

const projectRoot = path.resolve(__dirname, '..', '..');

function runSeed(env: Record<string, string> = {}): string {
  // Usa `prisma db seed` que respeita o config `prisma.seed: tsx prisma/seed.ts`.
  // DATABASE_URL é passada EXPLICITAMENTE — sem isso, `prisma db seed` lê só .env (não .env.local).
  // stderr é capturado junto pra que assertions de erro batam no .toThrow().
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL não setada — verificar setup.ts');
  try {
    return execSync('npx prisma db seed', {
      cwd: projectRoot,
      env: {
        ...process.env,
        SUPER_ADMIN_EMAIL: SEED_EMAIL,
        DATABASE_URL: dbUrl,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
  } catch (err) {
    // execSync lança Error com `stderr`/`stdout` em buffers. Re-throw com mensagem unificada
    // pra `expect().toThrow(/regex/)` poder fazer match no conteúdo do stderr.
    const e = err as { stderr?: Buffer; stdout?: Buffer; message: string };
    const msg = [e.message, e.stderr?.toString(), e.stdout?.toString()].filter(Boolean).join('\n');
    throw new Error(msg);
  }
}

const db = DB_REACHABLE ? new PrismaClient() : null;

async function cleanup() {
  if (!db) return;
  await db.user.deleteMany({
    where: { email: { in: [SEED_EMAIL, SEED_EMAIL_ALT, 'webhook-recon@example.com'] } },
  });
  await db.whatsAppNumber.deleteMany({ where: { phone_number_id: PLACEHOLDER_PHONE_ID } });
}

describe.skipIf(!DB_REACHABLE)('seed inicial (story 1.10)', () => {
  beforeEach(async () => {
    await cleanup();
  });

  it('em DB vazio cria super-admin + whatsapp_number', async () => {
    runSeed();

    const user = await db!.user.findUnique({ where: { email: SEED_EMAIL } });
    expect(user).not.toBeNull();
    expect(user!.role).toBe('super_admin');
    expect(user!.clerk_id).toBe(expectedPendingClerkId(SEED_EMAIL));
    expect(user!.condominio_id).toBeNull();
    expect(user!.ativo).toBe(true);

    const wa = await db!.whatsAppNumber.findUnique({ where: { phone_number_id: PLACEHOLDER_PHONE_ID } });
    expect(wa).not.toBeNull();
    expect(wa!.ativo).toBe(false); // placeholder nasce inativo
    expect(wa!.condominio_id).toBeNull(); // compartilhado
  });

  it('segundo run é idempotente (sem duplicação)', async () => {
    runSeed();
    runSeed();

    const users = await db!.user.findMany({ where: { email: SEED_EMAIL } });
    expect(users.length).toBe(1);

    const numbers = await db!.whatsAppNumber.findMany({ where: { phone_number_id: PLACEHOLDER_PHONE_ID } });
    expect(numbers.length).toBe(1);
  });

  it('reconciliação: pré-existente com role porteiro vira super_admin sem duplicar', async () => {
    // Simula webhook Clerk chegando antes do seed
    await db!.user.create({
      data: {
        clerk_id: 'clerk_pre_existing_123',
        email: SEED_EMAIL,
        nome: 'User Pre-Webhook',
        role: 'porteiro',
        condominio_id: null,
        ativo: true,
      },
    });

    runSeed();

    const users = await db!.user.findMany({ where: { email: SEED_EMAIL } });
    expect(users.length).toBe(1);
    expect(users[0].role).toBe('super_admin');
    // Crítico: clerk_id real preservado (não sobrescrito por placeholder)
    expect(users[0].clerk_id).toBe('clerk_pre_existing_123');
  });

  it('em NODE_ENV=production sem META_PHONE_NUMBER_ID aborta com erro', () => {
    expect(() =>
      runSeed({ NODE_ENV: 'production' }),
    ).toThrow(/META_PHONE_NUMBER_ID/);
  });

  it('rodar seed para 2 emails diferentes não causa unique constraint collision', async () => {
    // Regressão do bug HIGH (QA review story 1.10): clerk_id literal `pending_clerk_link`
    // colidia quando o seed era rodado para um SEGUNDO super-admin (troca de SUPER_ADMIN_EMAIL).
    // Fix: clerk_id = `pending_clerk_link_${sha256(email).slice(0,16)}` — único por email.
    runSeed({ SUPER_ADMIN_EMAIL: SEED_EMAIL });
    runSeed({ SUPER_ADMIN_EMAIL: SEED_EMAIL_ALT });

    const u1 = await db!.user.findUnique({ where: { email: SEED_EMAIL } });
    const u2 = await db!.user.findUnique({ where: { email: SEED_EMAIL_ALT } });

    expect(u1).not.toBeNull();
    expect(u2).not.toBeNull();
    expect(u1!.clerk_id).toBe(expectedPendingClerkId(SEED_EMAIL));
    expect(u2!.clerk_id).toBe(expectedPendingClerkId(SEED_EMAIL_ALT));
    expect(u1!.clerk_id).not.toBe(u2!.clerk_id);
    expect(u1!.role).toBe('super_admin');
    expect(u2!.role).toBe('super_admin');
  });
});
