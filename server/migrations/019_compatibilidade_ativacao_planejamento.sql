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

    -- Ausência de linhas representa o contrato legado com todos os módulos ativos.
    -- Se a 018 criou a primeira e única linha, removê-la preserva essa configuração.
    IF total_modulos = 1 AND EXISTS (
      SELECT 1 FROM app.tenant_modules
       WHERE tenant_id = empresa.id AND module_id = 'planejamento'
    ) THEN
      DELETE FROM app.tenant_modules
       WHERE tenant_id = empresa.id AND module_id = 'planejamento';
    END IF;
  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
END;
$$;
