-- Audit log RLS: tenant isolation for reads, unrestricted inserts
-- Super-admin sees all, tenant users see only their condominio's logs

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

-- SELECT: tenant sees own condominio logs, super_admin sees all
DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log
  FOR SELECT
  USING (
    app_is_super_admin()
    OR condominio_id IS NULL
    OR condominio_id = app_current_condominio()
  );

-- INSERT: any authenticated role can write audit logs (no restriction)
DROP POLICY IF EXISTS audit_log_insert ON audit_log;
CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT
  WITH CHECK (true);

-- UPDATE/DELETE: only super_admin (audit logs should be immutable, but allow for corrections)
DROP POLICY IF EXISTS audit_log_modify ON audit_log;
CREATE POLICY audit_log_modify ON audit_log
  FOR UPDATE
  USING (app_is_super_admin());

DROP POLICY IF EXISTS audit_log_delete ON audit_log;
CREATE POLICY audit_log_delete ON audit_log
  FOR DELETE
  USING (app_is_super_admin());
