CREATE OR REPLACE FUNCTION app.impedir_alteracao_movimentacao_patrimonial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.patrimonial_test_cleanup', true) = 'autorizado' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'movimentações patrimoniais são imutáveis' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER patrimonial_movements_imutaveis ON app.patrimonial_movements;
CREATE TRIGGER patrimonial_movements_imutaveis
BEFORE UPDATE OR DELETE ON app.patrimonial_movements
FOR EACH ROW EXECUTE FUNCTION app.impedir_alteracao_movimentacao_patrimonial();

CREATE OR REPLACE FUNCTION app.limpar_patrimonio_tenant_teste(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
DECLARE
  equipe record;
  total integer := 0;
  removidos integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app.tenants
     WHERE id = p_tenant_id AND nome LIKE 'Teste %'
  ) THEN
    RAISE EXCEPTION 'a limpeza patrimonial é exclusiva para organizações técnicas de teste'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.tenant_id', p_tenant_id::text, true);
  PERFORM set_config('app.patrimonial_test_cleanup', 'autorizado', true);
  FOR equipe IN SELECT id FROM app.teams WHERE tenant_id = p_tenant_id LOOP
    PERFORM set_config('app.team_id', equipe.id::text, true);
    DELETE FROM app.patrimonial_movements WHERE tenant_id = p_tenant_id;
    GET DIAGNOSTICS removidos = ROW_COUNT;
    total := total + removidos;
    DELETE FROM app.patrimonial_assets WHERE tenant_id = p_tenant_id;
    DELETE FROM app.patrimonial_units WHERE tenant_id = p_tenant_id;
  END LOOP;
  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION app.impedir_alteracao_movimentacao_patrimonial() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.limpar_patrimonio_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_patrimonio_tenant_teste(uuid) TO prumo_migrator;

COMMENT ON FUNCTION app.limpar_patrimonio_tenant_teste(uuid) IS
  'Remove o patrimônio somente de organizações técnicas Teste %, sem exposição à API.';
