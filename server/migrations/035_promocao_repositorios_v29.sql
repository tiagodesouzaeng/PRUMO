CREATE TABLE app.repository_transition_verifications (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid,
  dominio_id text NOT NULL CHECK (dominio_id IN ('orcamentos','composicoes-proprias','bases-precos','configuracoes')),
  local_total integer NOT NULL CHECK (local_total>=0),
  corporate_total integer NOT NULL CHECK (corporate_total>=0),
  local_hash text NOT NULL CHECK (local_hash ~ '^[0-9a-f]{64}$'),
  corporate_hash text NOT NULL CHECK (corporate_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('conforme','divergente')),
  divergencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  verificado_por text NOT NULL,
  verificado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id)
);

ALTER TABLE app.repository_transitions
  ADD COLUMN verificacao_id uuid,
  ADD COLUMN verificado_em timestamptz,
  ADD COLUMN motivo_retorno text NOT NULL DEFAULT '',
  ADD COLUMN versao bigint NOT NULL DEFAULT 1 CHECK(versao>0),
  ADD CONSTRAINT repository_transitions_verificacao_fk
    FOREIGN KEY(tenant_id,verificacao_id) REFERENCES app.repository_transition_verifications(tenant_id,id);

CREATE INDEX repository_verifications_domain_idx
  ON app.repository_transition_verifications(tenant_id,team_id,dominio_id,verificado_em DESC);

ALTER TABLE app.repository_transition_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.repository_transition_verifications FORCE ROW LEVEL SECURITY;
CREATE POLICY repository_transition_verifications_isolamento ON app.repository_transition_verifications FOR ALL
  USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (team_id IS NULL OR team_id=nullif(current_setting('app.team_id',true),'')::uuid))
  WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND (team_id IS NULL OR team_id=nullif(current_setting('app.team_id',true),'')::uuid));

CREATE OR REPLACE FUNCTION app.validar_promocao_repositorio()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.modo='corporativo' AND OLD.modo<>'corporativo' AND NOT EXISTS(
    SELECT 1 FROM app.repository_transition_verifications v
     WHERE v.tenant_id=NEW.tenant_id AND v.id=NEW.verificacao_id
       AND v.dominio_id=NEW.dominio_id AND v.status='conforme'
       AND v.verificado_em>=now()-interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'promoção corporativa exige verificação de paridade válida nas últimas 24 horas' USING ERRCODE='23514';
  END IF;
  IF OLD.modo='corporativo' AND NEW.modo='hibrido' AND length(btrim(NEW.motivo_retorno))<10 THEN
    RAISE EXCEPTION 'retorno ao modo híbrido exige justificativa' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER repository_transitions_promocao_segura
BEFORE UPDATE ON app.repository_transitions
FOR EACH ROW EXECUTE FUNCTION app.validar_promocao_repositorio();

CREATE TRIGGER repository_transition_verifications_imutaveis
BEFORE UPDATE OR DELETE ON app.repository_transition_verifications
FOR EACH ROW EXECUTE FUNCTION app.impedir_alteracao_historico();

CREATE OR REPLACE FUNCTION app.impedir_alteracao_historico()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.limpeza_documental_teste', true)='permitida'
     AND pg_has_role(current_user,'prumo_migrator','member') THEN RETURN OLD; END IF;
  IF current_setting('app.limpeza_repositorio_teste', true)='permitida'
     AND pg_has_role(current_user,'prumo_migrator','member') THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'registros históricos são imutáveis' USING ERRCODE='42501';
END;
$$;

CREATE OR REPLACE FUNCTION app.limpar_transicoes_tenant_teste(p_tenant_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE total integer;
BEGIN
  IF NOT pg_has_role(session_user,'prumo_migrator','member') THEN
    RAISE EXCEPTION 'limpeza de transições restrita à identidade de migração' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('app.limpeza_repositorio_teste','permitida',true);
  DELETE FROM app.repository_transitions WHERE tenant_id=p_tenant_id;
  DELETE FROM app.repository_transition_verifications WHERE tenant_id=p_tenant_id;
  GET DIAGNOSTICS total=ROW_COUNT;
  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION app.validar_promocao_repositorio() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.limpar_transicoes_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_transicoes_tenant_teste(uuid) TO prumo_migrator;
GRANT SELECT,INSERT ON app.repository_transition_verifications TO prumo_api;

INSERT INTO app.module_catalog_versions(versao,status,descricao,criado_por)
VALUES(14,'publicada','Catálogo modular PRUMO 29.0 — promoção corporativa verificável','migracao-035');
