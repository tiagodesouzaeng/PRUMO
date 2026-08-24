-- Sprint 31 — catálogo seguro de responsáveis do cliente ativo.
CREATE OR REPLACE FUNCTION app.listar_responsaveis_corporativos()
RETURNS TABLE(tipo text,id text,nome text,perfil_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=app,pg_temp AS $$
  SELECT 'usuario'::text,m.identity_subject,m.identity_subject,m.perfil_id
    FROM app.memberships m
   WHERE m.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
     AND m.status='ativo'
  UNION ALL
  SELECT 'equipe'::text,t.id::text,t.nome,''::text
    FROM app.teams t
   WHERE t.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
     AND t.status='ativo'
  ORDER BY 1,3;
$$;
REVOKE ALL ON FUNCTION app.listar_responsaveis_corporativos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.listar_responsaveis_corporativos() TO prumo_api;
