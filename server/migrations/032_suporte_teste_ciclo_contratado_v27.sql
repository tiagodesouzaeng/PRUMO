-- Suporte estritamente limitado à remoção das massas de integração da Sprint 27.
CREATE OR REPLACE FUNCTION app.block_contract_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.contract_cycle_test_cleanup',true)='autorizado' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'histórico contratual é imutável' USING ERRCODE='55000';
END; $$;

CREATE OR REPLACE FUNCTION app.limpar_ciclo_contratado_tenant_teste(p_tenant_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE equipe record; total integer:=0; removidos integer:=0;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM app.tenants WHERE id=p_tenant_id AND nome LIKE 'Teste %') THEN RAISE EXCEPTION 'limpeza permitida somente para organizações de teste' USING ERRCODE='42501'; END IF;
  PERFORM set_config('app.tenant_id',p_tenant_id::text,true); PERFORM set_config('app.contract_cycle_test_cleanup','autorizado',true);
  FOR equipe IN SELECT id FROM app.teams WHERE tenant_id=p_tenant_id LOOP
    PERFORM set_config('app.team_id',equipe.id::text,true);
    DELETE FROM app.work_change_request_decisions WHERE tenant_id=p_tenant_id;
    DELETE FROM app.work_change_requests WHERE tenant_id=p_tenant_id;
    DELETE FROM app.budget_contract_baselines WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS removidos=ROW_COUNT; total:=total+removidos;
  END LOOP; RETURN total;
END; $$;
REVOKE ALL ON FUNCTION app.limpar_ciclo_contratado_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_ciclo_contratado_tenant_teste(uuid) TO prumo_migrator;
