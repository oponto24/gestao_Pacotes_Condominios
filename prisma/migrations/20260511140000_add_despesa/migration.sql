-- Migração: tabela despesa (controle financeiro global do app).
-- Não tem condominio_id — registros globais visíveis só pra super-admin.

CREATE TABLE "despesa" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "servico"        VARCHAR(200) NOT NULL,
  "descricao"      TEXT,
  "id_pagamento"   VARCHAR(100),
  "id_assinatura"  VARCHAR(100),
  "valor_brl"      DECIMAL(10, 2),
  "pago_em"        DATE         NOT NULL,
  "criado_em"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "atualizado_em"  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX "despesa_pago_em_idx" ON "despesa" ("pago_em" DESC);

-- Seeds iniciais (despesas reportadas pelo Gustavo em 2026-05-11)

-- 1. VPS Hostinger KVM 2 — pagamento mensal recorrente
INSERT INTO "despesa" ("servico", "descricao", "id_pagamento", "id_assinatura", "valor_brl", "pago_em")
VALUES (
  'KVM 2 — srv1650118.hstgr.cloud',
  'VPS Hostinger Brasil — hospedagem produção',
  'H_42769663',
  'AzZJwXVIsATtc3htC',
  70.99,
  '2026-05-06'
);

-- 2. Chip WhatsApp Business — comprado pelo Bruno, nota fiscal pendente
INSERT INTO "despesa" ("servico", "descricao", "valor_brl", "pago_em")
VALUES (
  'Chip dedicado WhatsApp Business',
  'Chip pré-pago dedicado para WhatsApp Business em produção. Comprado pelo Bruno — valor aguardando NF.',
  NULL,
  '2026-05-11'
);
