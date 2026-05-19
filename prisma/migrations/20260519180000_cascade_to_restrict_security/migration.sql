-- Security: Replace CASCADE with RESTRICT on condominio FKs
-- Prevents accidental data loss when deleting a condominio

-- Setor → Condominio
ALTER TABLE "setor" DROP CONSTRAINT "setor_condominio_id_fkey";
ALTER TABLE "setor" ADD CONSTRAINT "setor_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bloco → Condominio
ALTER TABLE "bloco" DROP CONSTRAINT "bloco_condominio_id_fkey";
ALTER TABLE "bloco" ADD CONSTRAINT "bloco_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unidade → Condominio
ALTER TABLE "unidade" DROP CONSTRAINT "unidade_condominio_id_fkey";
ALTER TABLE "unidade" ADD CONSTRAINT "unidade_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Morador → Condominio
ALTER TABLE "morador" DROP CONSTRAINT "morador_condominio_id_fkey";
ALTER TABLE "morador" ADD CONSTRAINT "morador_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Morador → Unidade (was CASCADE, now RESTRICT — deleting unidade must not cascade to moradores)
ALTER TABLE "morador" DROP CONSTRAINT "morador_unidade_id_fkey";
ALTER TABLE "morador" ADD CONSTRAINT "morador_unidade_id_fkey"
  FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Pacote → Condominio
ALTER TABLE "pacote" DROP CONSTRAINT "pacote_condominio_id_fkey";
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- WhatsAppMessage → Condominio
ALTER TABLE "whatsapp_message" DROP CONSTRAINT "whatsapp_message_condominio_id_fkey";
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CodigoMlPendente → Condominio
ALTER TABLE "codigo_ml_pendente" DROP CONSTRAINT "codigo_ml_pendente_condominio_id_fkey";
ALTER TABLE "codigo_ml_pendente" ADD CONSTRAINT "codigo_ml_pendente_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CodigoMlPendente → Morador (was CASCADE, now RESTRICT — soft delete preferred)
ALTER TABLE "codigo_ml_pendente" DROP CONSTRAINT "codigo_ml_pendente_morador_id_fkey";
ALTER TABLE "codigo_ml_pendente" ADD CONSTRAINT "codigo_ml_pendente_morador_id_fkey"
  FOREIGN KEY ("morador_id") REFERENCES "morador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
