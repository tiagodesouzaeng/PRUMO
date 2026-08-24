-- Sprint 31 — limpeza segura de homologação e funções operacionais restritas.
CREATE OR REPLACE FUNCTION app.limpar_utilidades_tenant_teste(p_tenant_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE equipe record; total integer:=0; parcial integer:=0;
BEGIN
 IF NOT pg_has_role(session_user,'prumo_migrator','member') THEN
   RAISE EXCEPTION 'limpeza de utilidades restrita à identidade de migração' USING ERRCODE='42501';
 END IF;
 FOR equipe IN SELECT id FROM app.teams WHERE tenant_id=p_tenant_id LOOP
   PERFORM set_config('app.tenant_id',p_tenant_id::text,true);
   PERFORM set_config('app.team_id',equipe.id::text,true);
   PERFORM set_config('app.limpeza_documental_teste','permitida',true);
   DELETE FROM app.utility_readings WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; total:=total+parcial;
   DELETE FROM app.utility_meters WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; total:=total+parcial;
 END LOOP;
 RETURN total;
END; $$;
REVOKE ALL ON FUNCTION app.limpar_utilidades_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_utilidades_tenant_teste(uuid) TO prumo_migrator;
