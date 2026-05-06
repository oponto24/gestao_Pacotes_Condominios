-- =====================================================================
-- RLS POLICIES — Multi-tenancy híbrido (camada 2: rede de segurança)
-- =====================================================================
-- Aplicado APÓS prisma migrate deploy.
-- Contexto setado pelo middleware aplicacional via:
--   SET LOCAL app.current_condominio = '<uuid>';
--   SET LOCAL app.is_super_admin = 'true' | 'false';
--
-- Idempotente: pode rodar múltiplas vezes sem erro.
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
DROP POLICY IF EXISTS setor_tenant_isolation ON setor;
CREATE POLICY setor_tenant_isolation ON setor
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- Unidade
ALTER TABLE unidade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS unidade_tenant_isolation ON unidade;
CREATE POLICY unidade_tenant_isolation ON unidade
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- Morador
ALTER TABLE morador ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS morador_tenant_isolation ON morador;
CREATE POLICY morador_tenant_isolation ON morador
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- EXCEÇÃO: webhook Meta precisa fazer lookup global por telefone (sem tenant context).
-- Solução: rota webhook usa role Postgres separada com BYPASSRLS.
-- Ver docs/architecture/database/RLS_PATTERNS.md.

-- Pacote
ALTER TABLE pacote ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pacote_tenant_isolation ON pacote;
CREATE POLICY pacote_tenant_isolation ON pacote
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- PacoteFoto
ALTER TABLE pacote_foto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pacote_foto_tenant_isolation ON pacote_foto;
CREATE POLICY pacote_foto_tenant_isolation ON pacote_foto
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- PacoteEvento
ALTER TABLE pacote_evento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pacote_evento_tenant_isolation ON pacote_evento;
CREATE POLICY pacote_evento_tenant_isolation ON pacote_evento
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- WhatsAppMessage
ALTER TABLE whatsapp_message ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_message_tenant_isolation ON whatsapp_message;
CREATE POLICY whatsapp_message_tenant_isolation ON whatsapp_message
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- CodigoMlPendente
ALTER TABLE codigo_ml_pendente ENABLE ROW LEVEL SECURITY;
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

GRANT CONNECT ON DATABASE CURRENT_DATABASE() TO webhook_worker;
GRANT USAGE ON SCHEMA public TO webhook_worker;
GRANT SELECT ON morador TO webhook_worker;
GRANT INSERT, SELECT, UPDATE ON whatsapp_message TO webhook_worker;
GRANT INSERT, SELECT ON pacote_evento TO webhook_worker;
GRANT INSERT, SELECT, UPDATE ON codigo_ml_pendente TO webhook_worker;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO webhook_worker;
