-- =====================================================================
-- ENABLE RLS PROD (story RLS-001) — replica conteúdo do rls_policies.sql
-- da migration inicial, que NUNCA foi rodado em prod.
--
-- Idempotente: todos `CREATE OR REPLACE`, `IF NOT EXISTS`, `DROP IF EXISTS`.
-- Pode rodar múltiplas vezes sem efeito colateral.
--
-- IMPORTANTE pós-deploy: definir senhas dos roles novos (não vão em
-- migration) via SQL manual:
--   ALTER ROLE app_runtime WITH PASSWORD '<senha-runtime>';
--   ALTER ROLE webhook_worker WITH PASSWORD '<senha-webhook>';
-- E atualizar `.env.prod` com essas conexões antes de restartar containers.
--
-- Runbook completo: docs/stories/rls-001-ligar-em-prod.story.md
-- =====================================================================

-- ------------------------------------------------------------
-- HELPER: extrai condomínio atual de forma segura
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_condominio()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_condominio', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_super_admin', true), '')::boolean, false)
$$;

-- ------------------------------------------------------------
-- TABELAS TENANT-SCOPED — RLS habilitado + policy de isolamento
-- ------------------------------------------------------------

-- Setor
ALTER TABLE setor ENABLE ROW LEVEL SECURITY;
ALTER TABLE setor FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS setor_tenant_isolation ON setor;
CREATE POLICY setor_tenant_isolation ON setor
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- Unidade
ALTER TABLE unidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidade FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS unidade_tenant_isolation ON unidade;
CREATE POLICY unidade_tenant_isolation ON unidade
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- Morador
ALTER TABLE morador ENABLE ROW LEVEL SECURITY;
ALTER TABLE morador FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS morador_tenant_isolation ON morador;
CREATE POLICY morador_tenant_isolation ON morador
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- EXCEÇÃO: webhook Meta precisa fazer lookup global por telefone (sem tenant context).
-- Solução: rota webhook usa role Postgres separada com BYPASSRLS.
-- Ver docs/architecture/database/RLS_PATTERNS.md.

-- Pacote
ALTER TABLE pacote ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacote FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pacote_tenant_isolation ON pacote;
CREATE POLICY pacote_tenant_isolation ON pacote
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- PacoteFoto
ALTER TABLE pacote_foto ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacote_foto FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pacote_foto_tenant_isolation ON pacote_foto;
CREATE POLICY pacote_foto_tenant_isolation ON pacote_foto
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- PacoteEvento
ALTER TABLE pacote_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacote_evento FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pacote_evento_tenant_isolation ON pacote_evento;
CREATE POLICY pacote_evento_tenant_isolation ON pacote_evento
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- WhatsAppMessage
ALTER TABLE whatsapp_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_message_tenant_isolation ON whatsapp_message;
CREATE POLICY whatsapp_message_tenant_isolation ON whatsapp_message
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- CodigoMlPendente
ALTER TABLE codigo_ml_pendente ENABLE ROW LEVEL SECURITY;
ALTER TABLE codigo_ml_pendente FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS codigo_ml_pendente_tenant_isolation ON codigo_ml_pendente;
CREATE POLICY codigo_ml_pendente_tenant_isolation ON codigo_ml_pendente
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- ------------------------------------------------------------
-- TABELAS GLOBAIS — sem RLS (acesso por super_admin via aplicação)
-- ------------------------------------------------------------
-- condominio, user, whatsapp_number, audit_log
-- Isolamento garantido pela aplicação (middleware de role).

-- ------------------------------------------------------------
-- ROLE DE RUNTIME APP (NOSUPERUSER — sujeita a RLS)
-- ------------------------------------------------------------
-- POSTGRES_USER=app vem como SUPERUSER do docker postgres.
-- SUPERUSER bypassa RLS independente de BYPASSRLS/FORCE — inviável
-- pra runtime do app. Solução: role separada `app_runtime` SEM
-- SUPERUSER nem BYPASSRLS, com grants de DML em todas as tabelas.
-- Prisma migrate continua usando `app` (precisa SUPERUSER pra
-- criar extensions, enums, etc). App e testes usam `app_runtime`.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD NULL;
  END IF;
END $$;

GRANT CONNECT ON DATABASE gestao_pacotes TO app_runtime;
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
-- Default privileges para tabelas/sequences criadas no futuro pelo `app`:
ALTER DEFAULT PRIVILEGES FOR ROLE app IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE app IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- ------------------------------------------------------------
-- ROLE PARA WORKER WEBHOOK (BYPASSRLS)
-- ------------------------------------------------------------
-- Worker que recebe webhook Meta precisa fazer lookup cross-tenant
-- para identificar morador pelo telefone. Usa role separada.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'webhook_worker') THEN
    CREATE ROLE webhook_worker WITH LOGIN BYPASSRLS PASSWORD NULL;
  END IF;
END $$;

-- Senha definida via secret externo, não em migration:
--   ALTER ROLE webhook_worker WITH PASSWORD 'xxx';

-- Postgres não aceita função em GRANT CONNECT — usar nome literal
GRANT CONNECT ON DATABASE gestao_pacotes TO webhook_worker;
GRANT USAGE ON SCHEMA public TO webhook_worker;
GRANT SELECT ON morador TO webhook_worker;
GRANT INSERT, SELECT, UPDATE ON whatsapp_message TO webhook_worker;
GRANT INSERT, SELECT ON pacote_evento TO webhook_worker;
GRANT INSERT, SELECT, UPDATE ON codigo_ml_pendente TO webhook_worker;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO webhook_worker;
