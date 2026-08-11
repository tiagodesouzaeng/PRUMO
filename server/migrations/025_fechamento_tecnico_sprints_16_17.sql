CREATE OR REPLACE FUNCTION app.bloquear_historico_obras() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.construction_test_cleanup',true)='autorizado' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'histórico de fiscalização é imutável' USING ERRCODE='55000';
END; $$;

CREATE OR REPLACE FUNCTION app.bloquear_historico_manutencao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.maintenance_test_cleanup',true)='autorizado' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'histórico de manutenção é imutável' USING ERRCODE='55000';
END; $$;

CREATE OR REPLACE FUNCTION app.limpar_obras_tenant_teste(p_tenant_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE equipe record; removidos integer:=0; parcial integer:=0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app.tenants WHERE id=p_tenant_id AND nome LIKE 'Teste %') THEN
    RAISE EXCEPTION 'limpeza permitida somente para organizações de teste' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('app.tenant_id',p_tenant_id::text,true);
  PERFORM set_config('app.construction_test_cleanup','autorizado',true);
  FOR equipe IN SELECT id FROM app.teams WHERE tenant_id=p_tenant_id LOOP
    PERFORM set_config('app.team_id',equipe.id::text,true);
    DELETE FROM app.measurement_decisions WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; removidos:=removidos+parcial;
    DELETE FROM app.measurement_items WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; removidos:=removidos+parcial;
    DELETE FROM app.medicoes WHERE tenant_id=p_tenant_id AND obra_id IS NOT NULL; GET DIAGNOSTICS parcial=ROW_COUNT; removidos:=removidos+parcial;
    DELETE FROM app.work_diary_entries WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; removidos:=removidos+parcial;
    DELETE FROM app.work_schedule_items WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; removidos:=removidos+parcial;
    DELETE FROM app.empreendimentos WHERE tenant_id=p_tenant_id AND tipo='obra'; GET DIAGNOSTICS parcial=ROW_COUNT; removidos:=removidos+parcial;
  END LOOP;
  RETURN removidos;
END; $$;

CREATE OR REPLACE FUNCTION app.limpar_manutencao_tenant_teste(p_tenant_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE equipe record; removidos integer:=0; parcial integer:=0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app.tenants WHERE id=p_tenant_id AND nome LIKE 'Teste %') THEN
    RAISE EXCEPTION 'limpeza permitida somente para organizações de teste' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('app.tenant_id',p_tenant_id::text,true);
  PERFORM set_config('app.maintenance_test_cleanup','autorizado',true);
  FOR equipe IN SELECT id FROM app.teams WHERE tenant_id=p_tenant_id LOOP
    PERFORM set_config('app.team_id',equipe.id::text,true);
    DELETE FROM app.maintenance_decisions WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; removidos:=removidos+parcial;
    DELETE FROM app.maintenance_resources WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; removidos:=removidos+parcial;
    DELETE FROM app.maintenance_work_orders WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; removidos:=removidos+parcial;
    DELETE FROM app.maintenance_tickets WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; removidos:=removidos+parcial;
    DELETE FROM app.maintenance_plans WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; removidos:=removidos+parcial;
  END LOOP;
  RETURN removidos;
END; $$;

REVOKE ALL ON FUNCTION app.limpar_obras_tenant_teste(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.limpar_manutencao_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_obras_tenant_teste(uuid) TO prumo_migrator;
GRANT EXECUTE ON FUNCTION app.limpar_manutencao_tenant_teste(uuid) TO prumo_migrator;
