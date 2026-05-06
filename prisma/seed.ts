/**
 * Seed inicial — apenas dados estritamente necessários para subir o sistema.
 *
 * - 1 super-admin (Gustavo)
 * - 1 whatsapp_number compartilhado (placeholder, atualizar com IDs reais da Meta)
 *
 * Tudo idempotente (usa upsert).
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // 1. Super-admin (Gustavo)
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'gustavs.silvs@gmail.com';
  await db.user.upsert({
    where: { email: superAdminEmail },
    create: {
      clerk_id: 'placeholder_clerk_id_super_admin',
      email: superAdminEmail,
      nome: 'Gustavo Silva',
      role: 'super_admin',
      condominio_id: null,
    },
    update: {},
  });
  console.log('  ✓ Super-admin criado');

  // 2. WhatsApp number compartilhado (placeholder — substituir com Meta real)
  await db.whatsAppNumber.upsert({
    where: { phone_number_id: 'PLACEHOLDER_META_PHONE_NUMBER_ID' },
    create: {
      phone_number_id: 'PLACEHOLDER_META_PHONE_NUMBER_ID',
      waba_id: 'PLACEHOLDER_META_WABA_ID',
      display_phone: '+5511999999999',
      display_name: 'Sistema Pacotes',
      condominio_id: null, // null = compartilhado entre todos
      ativo: false, // desativado até credenciais reais entrarem
    },
    update: {},
  });
  console.log('  ✓ WhatsApp number placeholder criado');

  console.log('✅ Seed concluído.');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
