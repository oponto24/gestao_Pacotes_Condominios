/**
 * Seed inicial — apenas dados estritamente necessários para subir o sistema.
 *
 * - 1 super-admin (reconciliado por email — clerk_id pode chegar depois via webhook)
 * - 1 whatsapp_number compartilhado (placeholder em dev; em prod exige META_PHONE_NUMBER_ID)
 *
 * Tudo idempotente: rodar 2x não causa erro nem duplicação.
 *
 * Uso:
 *   npm run prisma:seed
 *   SUPER_ADMIN_EMAIL=outro@email.com npm run prisma:seed
 *   npm run db:reset-and-seed   # apenas dev (drop + migrate + seed)
 */

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { logger as rootLogger } from '../src/lib/logger';

const log = rootLogger.child({ mode: 'seed' });
const db = new PrismaClient();

// Marcador semântico de "super-admin criado pelo seed mas ainda não logou via Clerk".
// Único por email (sha256 hash 16 chars) para preservar unique constraint quando
// múltiplos super-admins são seedados (ex: troca de SUPER_ADMIN_EMAIL).
// Webhook Clerk (story 1.5) faz fallback por email e substitui por clerk_id real.
const PENDING_CLERK_PREFIX = 'pending_clerk_link';
function pendingClerkIdFor(email: string): string {
  const hash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 16);
  return `${PENDING_CLERK_PREFIX}_${hash}`;
}

interface SeedSummary {
  super_admin: 'created' | 'updated';
  whatsapp_number: 'created' | 'updated';
}

async function seedSuperAdmin(email: string): Promise<'created' | 'updated'> {
  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    // Reconciliação: preserva clerk_id real se já vier do webhook.
    // Sobrescreve role para super_admin (caso webhook tenha criado como porteiro default).
    await db.user.update({
      where: { email },
      data: {
        role: 'super_admin',
        condominio_id: null,
        ativo: true,
      },
    });
    log.info({ super_admin_email: email, clerk_id: existing.clerk_id }, 'super-admin reconciliado');
    return 'updated';
  }

  await db.user.create({
    data: {
      clerk_id: pendingClerkIdFor(email),
      email,
      nome: 'Super Admin',
      role: 'super_admin',
      condominio_id: null,
      ativo: true,
    },
  });
  log.info({ super_admin_email: email }, 'super-admin criado pendente (aguardando login via Clerk)');
  return 'created';
}

async function seedWhatsAppNumber(): Promise<'created' | 'updated'> {
  const isProd = process.env.NODE_ENV === 'production';
  // Trata string vazia como "ausente" — `.env.local` tem `META_PHONE_NUMBER_ID=` (vazio).
  const realPhoneId = process.env.META_PHONE_NUMBER_ID?.trim() || undefined;
  const realWabaId = process.env.META_WABA_ID?.trim() || undefined;

  // Guard: em prod, exige credenciais reais. Não deixar placeholder em prod.
  if (isProd && (!realPhoneId || !realWabaId)) {
    throw new Error(
      'NODE_ENV=production exige META_PHONE_NUMBER_ID e META_WABA_ID setados. ' +
        'Atualize via Meta Business Manager antes do seed em prod.',
    );
  }

  const phoneId = realPhoneId ?? 'PLACEHOLDER_META_PHONE_NUMBER_ID';
  const wabaId = realWabaId ?? 'PLACEHOLDER_META_WABA_ID';
  const isPlaceholder = phoneId.startsWith('PLACEHOLDER_');

  const existing = await db.whatsAppNumber.findUnique({ where: { phone_number_id: phoneId } });

  if (existing) {
    await db.whatsAppNumber.update({
      where: { phone_number_id: phoneId },
      data: { waba_id: wabaId },
    });
    log.info({ whatsapp_phone_id: phoneId, placeholder: isPlaceholder }, 'whatsapp_number atualizado');
    return 'updated';
  }

  await db.whatsAppNumber.create({
    data: {
      phone_number_id: phoneId,
      waba_id: wabaId,
      display_phone: isPlaceholder ? '+5511999999999' : process.env.META_DISPLAY_PHONE ?? phoneId,
      display_name: 'Sistema Pacotes',
      condominio_id: null, // null = compartilhado entre todos os tenants
      ativo: !isPlaceholder, // placeholders nascem inativos
    },
  });
  log.info({ whatsapp_phone_id: phoneId, placeholder: isPlaceholder }, 'whatsapp_number criado');

  if (isPlaceholder) {
    log.warn(
      { whatsapp_phone_id: phoneId },
      '⚠️  WhatsApp number = PLACEHOLDER. Atualizar com IDs reais via Meta Business Manager (story 4.1)',
    );
  }
  return 'created';
}

async function main(): Promise<SeedSummary> {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'gustavs.silvs@gmail.com';
  log.info({ super_admin_email: superAdminEmail, node_env: process.env.NODE_ENV }, 'iniciando seed');

  const summary: SeedSummary = {
    super_admin: await seedSuperAdmin(superAdminEmail),
    whatsapp_number: await seedWhatsAppNumber(),
  };

  const created = Object.values(summary).filter((s) => s === 'created').length;
  const updated = Object.values(summary).filter((s) => s === 'updated').length;
  log.info({ summary, created, updated }, 'seed concluído');
  return summary;
}

main()
  .catch((err) => {
    log.error({ err: err instanceof Error ? err.message : err, step: 'main' }, 'seed falhou');
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
