DROP POLICY IF EXISTS audit_events_limpeza_teste ON app.audit_events;
CREATE POLICY audit_events_limpeza_teste ON app.audit_events
  FOR DELETE
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND current_setting('app.audit_test_cleanup', true) = 'autorizado'
  );

CREATE OR REPLACE FUNCTION app.limpar_auditoria_tenant_teste(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
DECLARE
  v_total integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM app.tenants
     WHERE id = p_tenant_id
       AND nome LIKE 'Teste %'
  ) THEN
    RAISE EXCEPTION 'a limpeza é exclusiva para organizações técnicas de teste'
      USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.tenant_id', p_tenant_id::text, true);
  PERFORM set_config('app.audit_test_cleanup', 'autorizado', true);
  DELETE FROM app.audit_events WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION app.limpar_auditoria_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_auditoria_tenant_teste(uuid) TO prumo_migrator;
