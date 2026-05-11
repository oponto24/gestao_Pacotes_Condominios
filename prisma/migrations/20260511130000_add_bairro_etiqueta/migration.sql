-- Migração: adiciona bairro_etiqueta à tabela pacote.
-- IA já extrai bairro separado do endereço (REGRA #2 do prompt), mas o valor
-- só ia para ia_extracao_raw (JSON). Promove para coluna top-level pra:
--  1. Exibir no formulário de confirmação (porteiro vê e edita)
--  2. Auditoria e futuros relatórios por bairro
-- Coluna nullable — backfill não necessário (rows antigas mantêm null).

ALTER TABLE "pacote"
  ADD COLUMN "bairro_etiqueta" VARCHAR(100);
