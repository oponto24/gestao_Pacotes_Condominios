-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'admin', 'porteiro');

-- CreateEnum
CREATE TYPE "TamanhoPacote" AS ENUM ('pequeno', 'medio', 'grande', 'extra_grande');

-- CreateEnum
CREATE TYPE "PacoteStatus" AS ENUM ('rascunho', 'pendente_identificacao', 'aguardando_retirada', 'retirado', 'cancelado');

-- CreateEnum
CREATE TYPE "PacoteEventoTipo" AS ENUM ('criado', 'ia_processou', 'confirmado', 'notificado', 'notificacao_falhou', 'retirado', 'cancelado', 'pendencia_resolvida', 'reenvio_notificacao');

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');

-- CreateEnum
CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('outbound', 'inbound');

-- CreateEnum
CREATE TYPE "CodigoMlStatus" AS ENUM ('pendente', 'consumido', 'expirado');

-- CreateEnum
CREATE TYPE "Transportadora" AS ENUM ('correios', 'magalu', 'melhor_envio', 'super_frete', 'loggi', 'mercado_livre', 'shopee', 'amazon', 'outro');

-- CreateTable
CREATE TABLE "condominio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(200) NOT NULL,
    "cnpj" VARCHAR(18),
    "endereco" VARCHAR(300) NOT NULL,
    "cep" VARCHAR(9) NOT NULL,
    "cidade" VARCHAR(100) NOT NULL,
    "estado" VARCHAR(2) NOT NULL,
    "contato_nome" VARCHAR(200) NOT NULL,
    "contato_telefone" VARCHAR(20) NOT NULL,
    "contato_email" VARCHAR(200),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "condominio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clerk_id" VARCHAR(100) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "role" "UserRole" NOT NULL,
    "condominio_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_number" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone_number_id" VARCHAR(50) NOT NULL,
    "waba_id" VARCHAR(50) NOT NULL,
    "display_phone" VARCHAR(20) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "condominio_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "quality_rating" VARCHAR(20),
    "messaging_limit_tier" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_number_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "condominio_id" UUID,
    "acao" VARCHAR(100) NOT NULL,
    "entidade_tipo" VARCHAR(50),
    "entidade_id" VARCHAR(100),
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setor" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "condominio_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" VARCHAR(300),
    "capacidade" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidade" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "condominio_id" UUID NOT NULL,
    "identificador" VARCHAR(50) NOT NULL,
    "bloco" VARCHAR(50),
    "observacoes" VARCHAR(500),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "morador" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "condominio_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "nome_normalizado" VARCHAR(200) NOT NULL,
    "telefone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(200),
    "is_principal" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "morador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "condominio_id" UUID NOT NULL,
    "codigo_rastreio" VARCHAR(100),
    "transportadora" "Transportadora",
    "nome_destinatario_etiqueta" VARCHAR(200),
    "endereco_etiqueta" VARCHAR(500),
    "cep_etiqueta" VARCHAR(9),
    "complemento_etiqueta" VARCHAR(200),
    "remetente" VARCHAR(200),
    "unidade_id" UUID,
    "destinatario_id" UUID,
    "destinatario_resolvido_via" VARCHAR(30),
    "tamanho" "TamanhoPacote",
    "setor_id" UUID,
    "posicao" VARCHAR(50),
    "qr_token" VARCHAR(64) NOT NULL,
    "qr_consumido_em" TIMESTAMP(3),
    "funcionario_recebedor_id" UUID,
    "recebido_em" TIMESTAMP(3),
    "funcionario_entregador_id" UUID,
    "retirado_em" TIMESTAMP(3),
    "retirado_por_morador_id" UUID,
    "retirado_por_terceiro" VARCHAR(200),
    "status" "PacoteStatus" NOT NULL DEFAULT 'rascunho',
    "ia_extracao_raw" JSONB,
    "ia_confianca" DECIMAL(3,2),
    "ia_processada_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacote_foto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "condominio_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "hash_sha256" VARCHAR(64) NOT NULL,
    "is_principal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "condominioId" UUID,

    CONSTRAINT "pacote_foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacote_evento" (
    "id" BIGSERIAL NOT NULL,
    "condominio_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "tipo" "PacoteEventoTipo" NOT NULL,
    "user_id" UUID,
    "metadata" JSONB,
    "observacao" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "condominioId" UUID,

    CONSTRAINT "pacote_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "condominio_id" UUID NOT NULL,
    "whatsapp_number_id" UUID NOT NULL,
    "meta_message_id" VARCHAR(100),
    "direction" "WhatsAppMessageDirection" NOT NULL,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'pending',
    "to_phone" VARCHAR(20) NOT NULL,
    "from_phone" VARCHAR(20) NOT NULL,
    "template_name" VARCHAR(50),
    "template_params" JSONB,
    "body_text" TEXT,
    "pacote_id" UUID,
    "morador_id" UUID,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" VARCHAR(500),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigo_ml_pendente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "condominio_id" UUID NOT NULL,
    "morador_id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "descricao" VARCHAR(500),
    "mensagem_origem_id" UUID,
    "status" "CodigoMlStatus" NOT NULL DEFAULT 'pendente',
    "pacote_id" UUID,
    "consumido_em" TIMESTAMP(3),
    "expira_em" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigo_ml_pendente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "condominio_cnpj_key" ON "condominio"("cnpj");

-- CreateIndex
CREATE INDEX "condominio_cep_idx" ON "condominio"("cep");

-- CreateIndex
CREATE INDEX "condominio_ativo_idx" ON "condominio"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "user_clerk_id_key" ON "user"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_condominio_id_idx" ON "user"("condominio_id");

-- CreateIndex
CREATE INDEX "user_clerk_id_idx" ON "user"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_number_phone_number_id_key" ON "whatsapp_number"("phone_number_id");

-- CreateIndex
CREATE INDEX "whatsapp_number_condominio_id_idx" ON "whatsapp_number"("condominio_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_created_at_idx" ON "audit_log"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_condominio_id_created_at_idx" ON "audit_log"("condominio_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_acao_idx" ON "audit_log"("acao");

-- CreateIndex
CREATE INDEX "setor_condominio_id_ativo_idx" ON "setor"("condominio_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "setor_condominio_id_nome_key" ON "setor"("condominio_id", "nome");

-- CreateIndex
CREATE INDEX "unidade_condominio_id_idx" ON "unidade"("condominio_id");

-- CreateIndex
CREATE UNIQUE INDEX "unidade_condominio_id_identificador_bloco_key" ON "unidade"("condominio_id", "identificador", "bloco");

-- CreateIndex
CREATE INDEX "morador_condominio_id_unidade_id_idx" ON "morador"("condominio_id", "unidade_id");

-- CreateIndex
CREATE INDEX "morador_condominio_id_nome_normalizado_idx" ON "morador"("condominio_id", "nome_normalizado");

-- CreateIndex
CREATE INDEX "morador_telefone_idx" ON "morador"("telefone");

-- CreateIndex
CREATE INDEX "morador_condominio_id_is_principal_idx" ON "morador"("condominio_id", "is_principal");

-- CreateIndex
CREATE UNIQUE INDEX "morador_condominio_id_telefone_key" ON "morador"("condominio_id", "telefone");

-- CreateIndex
CREATE UNIQUE INDEX "pacote_qr_token_key" ON "pacote"("qr_token");

-- CreateIndex
CREATE INDEX "pacote_condominio_id_status_idx" ON "pacote"("condominio_id", "status");

-- CreateIndex
CREATE INDEX "pacote_condominio_id_unidade_id_idx" ON "pacote"("condominio_id", "unidade_id");

-- CreateIndex
CREATE INDEX "pacote_condominio_id_destinatario_id_idx" ON "pacote"("condominio_id", "destinatario_id");

-- CreateIndex
CREATE INDEX "pacote_condominio_id_recebido_em_idx" ON "pacote"("condominio_id", "recebido_em" DESC);

-- CreateIndex
CREATE INDEX "pacote_condominio_id_status_recebido_em_idx" ON "pacote"("condominio_id", "status", "recebido_em" DESC);

-- CreateIndex
CREATE INDEX "pacote_codigo_rastreio_idx" ON "pacote"("codigo_rastreio");

-- CreateIndex
CREATE INDEX "pacote_qr_token_idx" ON "pacote"("qr_token");

-- CreateIndex
CREATE INDEX "pacote_foto_pacote_id_idx" ON "pacote_foto"("pacote_id");

-- CreateIndex
CREATE INDEX "pacote_foto_condominio_id_idx" ON "pacote_foto"("condominio_id");

-- CreateIndex
CREATE INDEX "pacote_evento_pacote_id_created_at_idx" ON "pacote_evento"("pacote_id", "created_at");

-- CreateIndex
CREATE INDEX "pacote_evento_condominio_id_tipo_created_at_idx" ON "pacote_evento"("condominio_id", "tipo", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_message_meta_message_id_key" ON "whatsapp_message"("meta_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_message_condominio_id_created_at_idx" ON "whatsapp_message"("condominio_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "whatsapp_message_pacote_id_idx" ON "whatsapp_message"("pacote_id");

-- CreateIndex
CREATE INDEX "whatsapp_message_morador_id_idx" ON "whatsapp_message"("morador_id");

-- CreateIndex
CREATE INDEX "whatsapp_message_status_idx" ON "whatsapp_message"("status");

-- CreateIndex
CREATE INDEX "whatsapp_message_meta_message_id_idx" ON "whatsapp_message"("meta_message_id");

-- CreateIndex
CREATE INDEX "codigo_ml_pendente_condominio_id_morador_id_status_idx" ON "codigo_ml_pendente"("condominio_id", "morador_id", "status");

-- CreateIndex
CREATE INDEX "codigo_ml_pendente_condominio_id_status_expira_em_idx" ON "codigo_ml_pendente"("condominio_id", "status", "expira_em");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_number" ADD CONSTRAINT "whatsapp_number_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setor" ADD CONSTRAINT "setor_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidade" ADD CONSTRAINT "unidade_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "morador" ADD CONSTRAINT "morador_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "morador" ADD CONSTRAINT "morador_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "morador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_funcionario_recebedor_id_fkey" FOREIGN KEY ("funcionario_recebedor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_funcionario_entregador_id_fkey" FOREIGN KEY ("funcionario_entregador_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_retirado_por_morador_id_fkey" FOREIGN KEY ("retirado_por_morador_id") REFERENCES "morador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_foto" ADD CONSTRAINT "pacote_foto_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "pacote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_foto" ADD CONSTRAINT "pacote_foto_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_evento" ADD CONSTRAINT "pacote_evento_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "pacote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_evento" ADD CONSTRAINT "pacote_evento_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_evento" ADD CONSTRAINT "pacote_evento_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_whatsapp_number_id_fkey" FOREIGN KEY ("whatsapp_number_id") REFERENCES "whatsapp_number"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "pacote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_morador_id_fkey" FOREIGN KEY ("morador_id") REFERENCES "morador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigo_ml_pendente" ADD CONSTRAINT "codigo_ml_pendente_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigo_ml_pendente" ADD CONSTRAINT "codigo_ml_pendente_morador_id_fkey" FOREIGN KEY ("morador_id") REFERENCES "morador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigo_ml_pendente" ADD CONSTRAINT "codigo_ml_pendente_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "pacote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
