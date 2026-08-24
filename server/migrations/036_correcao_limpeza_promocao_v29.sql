-- Correção da limpeza restrita aos testes de promoção com RLS por equipe.
CREATE OR REPLACE FUNCTION app.limpar_transicoes_tenant_teste(p_tenant_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE
  equipe record;
  removidos integer := 0;
  parcial integer := 0;
BEGIN
  IF NOT pg_has_role(session_user,'prumo_migrator','member') THEN
    RAISE EXCEPTION 'limpeza de transições restrita à identidade de migração' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('app.tenant_id',p_tenant_id::text,true);
  PERFORM set_config('app.limpeza_repositorio_teste','permitida',true);

  FOR equipe IN
    SELECT id FROM app.teams WHERE tenant_id=p_tenant_id
    UNION ALL SELECT NULL::uuid
  LOOP
    PERFORM set_config('app.team_id',coalesce(equipe.id::text,''),true);
    DELETE FROM app.repository_transitions WHERE tenant_id=p_tenant_id;
    DELETE FROM app.repository_transition_verifications WHERE tenant_id=p_tenant_id;
    GET DIAGNOSTICS parcial=ROW_COUNT;
    removidos := removidos + parcial;
  END LOOP;
  RETURN removidos;
END;
$$;

REVOKE ALL ON FUNCTION app.limpar_transicoes_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_transicoes_tenant_teste(uuid) TO prumo_migrator;
