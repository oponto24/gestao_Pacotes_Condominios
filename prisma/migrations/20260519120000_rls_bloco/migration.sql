-- RLS para tabela bloco (criada em Epic 11, após a migration RLS original)
-- Idempotente: DROP POLICY IF EXISTS antes de CREATE.

ALTER TABLE bloco ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloco FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bloco_tenant_isolation ON bloco;
CREATE POLICY bloco_tenant_isolation ON bloco
  USING (condominio_id = app_current_condominio() OR app_is_super_admin())
  WITH CHECK (condominio_id = app_current_condominio() OR app_is_super_admin());

-- Grants pra roles criadas na migration 20260510160000
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON bloco TO app_runtime;
  END IF;
END $$;
