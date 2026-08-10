DO $$
DECLARE
  empresa record;
  total_modulos integer;
BEGIN
  FOR empresa IN SELECT id FROM app.tenants LOOP
    PERFORM set_config('app.tenant_id', empresa.id::text, true);
    SELECT count(*)::integer INTO total_modulos
      FROM app.tenant_modules
     WHERE tenant_id = empresa.id;

    -- Ausência de linhas significa que todos os módulos ativos são permitidos.
    -- Se a 012 criou a primeira e única linha, removê-la preserva esse contrato legado.
    IF total_modulos = 1 AND EXISTS (
      SELECT 1 FROM app.tenant_modules
       WHERE tenant_id = empresa.id AND module_id = 'patrimonio'
    ) THEN
      DELETE FROM app.tenant_modules
       WHERE tenant_id = empresa.id AND module_id = 'patrimonio';
    END IF;
  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
END;
$$;
