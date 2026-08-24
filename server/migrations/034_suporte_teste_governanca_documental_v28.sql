CREATE OR REPLACE FUNCTION app.impedir_alteracao_historico()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.limpeza_documental_teste', true) = 'permitida'
     AND pg_has_role(current_user, 'prumo_migrator', 'member') THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'registros históricos são imutáveis' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION app.limpar_documentos_tenant_teste(p_tenant_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE total integer;
BEGIN
  IF NOT pg_has_role(session_user, 'prumo_migrator', 'member') THEN
    RAISE EXCEPTION 'limpeza documental restrita à identidade de migração' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('app.limpeza_documental_teste','permitida',true);
  DELETE FROM app.document_links WHERE tenant_id=p_tenant_id;
  DELETE FROM app.document_versions WHERE tenant_id=p_tenant_id;
  DELETE FROM app.documents WHERE tenant_id=p_tenant_id;
  GET DIAGNOSTICS total=ROW_COUNT;
  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION app.limpar_documentos_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_documentos_tenant_teste(uuid) TO prumo_migrator;
