INSERT INTO app.modules (id, nome, ordem) VALUES
  ('contratos', 'Contratos e Atas', 55)
ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, ordem=EXCLUDED.ordem, status='ativo';

DO $$
DECLARE empresa record; total_modulos integer;
BEGIN
  FOR empresa IN SELECT id FROM app.tenants LOOP
    PERFORM set_config('app.tenant_id',empresa.id::text,true);
    SELECT count(*)::integer INTO total_modulos FROM app.tenant_modules WHERE tenant_id=empresa.id;
    IF total_modulos > 0 THEN
      INSERT INTO app.tenant_modules (tenant_id,module_id,status) VALUES (empresa.id,'contratos','ativo') ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO app.tenant_module_contracts (tenant_id,module_id,atualizado_por) VALUES (empresa.id,'contratos','migracao-021') ON CONFLICT DO NOTHING;
  END LOOP;
  PERFORM set_config('app.tenant_id','',true);
END; $$;

INSERT INTO app.permissions (id,module_id,descricao) VALUES
  ('contratos.consultar','contratos','Consultar contratos, atas e execução'),
  ('contratos.editar','contratos','Elaborar instrumentos contratuais'),
  ('contratos.gerir','contratos','Gerir vigência, responsáveis, garantias e aditivos'),
  ('contratos.fiscalizar','contratos','Registrar execução e ocorrências contratuais'),
  ('contratos.sancionar','contratos','Aplicar sanções contratuais'),
  ('contratos.encerrar','contratos','Concluir, rescindir e encerrar contratos')
ON CONFLICT (id) DO UPDATE SET module_id=EXCLUDED.module_id, descricao=EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions (perfil_id,permission_id)
SELECT 'administrador',id FROM app.permissions WHERE id LIKE 'contratos.%' ON CONFLICT DO NOTHING;
INSERT INTO app.default_profile_permissions (perfil_id,permission_id) VALUES
  ('gestor','contratos.consultar'),('gestor','contratos.editar'),('gestor','contratos.gerir'),('gestor','contratos.fiscalizar'),('gestor','contratos.encerrar'),
  ('fiscal','contratos.consultar'),('fiscal','contratos.fiscalizar'),
  ('aprovador','contratos.consultar'),('aprovador','contratos.gerir'),('aprovador','contratos.sancionar'),('aprovador','contratos.encerrar'),
  ('consulta','contratos.consultar')
ON CONFLICT DO NOTHING;

UPDATE app.module_catalog_versions SET status='substituida' WHERE status='publicada';
INSERT INTO app.module_catalog_versions (versao,status,descricao,criado_por)
VALUES (5,'publicada','Catálogo modular PRUMO 14.0','migracao-021');
INSERT INTO app.module_capabilities (module_id,capability_id,nome,versao_catalogo,status) VALUES
  ('contratos','instrumentos-atas','Contratos, atas e instrumentos equivalentes',5,'ativa'),
  ('contratos','vigencia-saldos','Vigência, valores, execução e saldos',5,'ativa'),
  ('contratos','gestao-fiscalizacao','Gestores, fiscais, garantias e ocorrências',5,'ativa'),
  ('contratos','alteracoes-sancoes','Aditivos, reajustes, sanções e encerramento',5,'ativa')
ON CONFLICT DO NOTHING;
INSERT INTO app.module_dependencies (module_id,depends_on_module_id,obrigatoria) VALUES
  ('contratos','suprimentos',true),('contratos','documentos',false),('contratos','medicoes',false)
ON CONFLICT (module_id,depends_on_module_id) DO UPDATE SET obrigatoria=EXCLUDED.obrigatoria;

CREATE TABLE app.contracts (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
  process_id uuid NOT NULL, supplier_id uuid NOT NULL, codigo text NOT NULL, numero text NOT NULL,
  titulo text NOT NULL, objeto text NOT NULL,
  tipo_instrumento text NOT NULL DEFAULT 'contrato' CHECK (tipo_instrumento IN ('contrato','ata_registro_precos','ordem_servico','termo','instrumento_equivalente')),
  regime text NOT NULL DEFAULT 'publico' CHECK (regime IN ('publico','federacao','privado')),
  data_assinatura date, data_inicio date NOT NULL, data_fim date NOT NULL,
  valor_inicial numeric(18,2) NOT NULL CHECK (valor_inicial > 0),
  valor_atual numeric(18,2) NOT NULL CHECK (valor_atual > 0),
  valor_executado numeric(18,2) NOT NULL DEFAULT 0 CHECK (valor_executado >= 0 AND valor_executado <= valor_atual),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','vigente','suspenso','concluido','rescindido','encerrado','cancelado')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_por text NOT NULL, atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id), UNIQUE (tenant_id,team_id,codigo), UNIQUE (tenant_id,team_id,numero),
  FOREIGN KEY (tenant_id,team_id) REFERENCES app.teams(tenant_id,id),
  FOREIGN KEY (tenant_id,process_id,team_id) REFERENCES app.procurement_processes(tenant_id,id,team_id),
  FOREIGN KEY (tenant_id,supplier_id,team_id) REFERENCES app.suppliers(tenant_id,id,team_id),
  CHECK (btrim(codigo)<>'' AND btrim(numero)<>'' AND btrim(titulo)<>'' AND btrim(objeto)<>''),
  CHECK (data_fim >= data_inicio)
);

CREATE TABLE app.contract_responsibles (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, contract_id uuid NOT NULL,
  papel text NOT NULL CHECK (papel IN ('gestor','fiscal_tecnico','fiscal_administrativo','substituto')),
  nome text NOT NULL, documento text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
  data_inicio date NOT NULL, data_fim date, ato_designacao text NOT NULL DEFAULT '',
  criado_por text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,contract_id,team_id) REFERENCES app.contracts(tenant_id,id,team_id),
  CHECK (btrim(nome)<>'' AND (data_fim IS NULL OR data_fim >= data_inicio))
);

CREATE TABLE app.contract_amendments (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, contract_id uuid NOT NULL,
  numero text NOT NULL, tipo text NOT NULL CHECK (tipo IN ('valor','prazo','prazo_valor','supressao','reajuste')),
  justificativa text NOT NULL, valor numeric(18,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  nova_data_fim date, dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  aprovado_por text NOT NULL, aprovado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,contract_id,numero),
  FOREIGN KEY (tenant_id,contract_id,team_id) REFERENCES app.contracts(tenant_id,id,team_id),
  CHECK (btrim(numero)<>'' AND btrim(justificativa)<>'')
);

CREATE TABLE app.contract_guarantees (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, contract_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('caucao','seguro_garantia','fianca_bancaria','retencao','dispensada')),
  numero text NOT NULL DEFAULT '', instituicao text NOT NULL DEFAULT '', valor numeric(18,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  data_inicio date, data_fim date, status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','liberada','executada','vencida','dispensada')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, criado_por text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,contract_id,team_id) REFERENCES app.contracts(tenant_id,id,team_id),
  CHECK (data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio)
);

CREATE TABLE app.contract_occurrences (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, contract_id uuid NOT NULL,
  data_ocorrencia date NOT NULL DEFAULT current_date, tipo text NOT NULL DEFAULT 'registro',
  severidade text NOT NULL DEFAULT 'baixa' CHECK (severidade IN ('baixa','media','alta','critica')),
  descricao text NOT NULL, providencia text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_tratamento','resolvida')),
  registrado_por text NOT NULL, registrado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,contract_id,team_id) REFERENCES app.contracts(tenant_id,id,team_id),
  CHECK (btrim(descricao)<>'')
);

CREATE TABLE app.contract_sanctions (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, contract_id uuid NOT NULL,
  occurrence_id uuid, tipo text NOT NULL CHECK (tipo IN ('advertencia','multa','suspensao','impedimento','declaracao_inidoneidade')),
  fundamento text NOT NULL, valor numeric(18,2) NOT NULL DEFAULT 0 CHECK (valor >= 0), data_aplicacao date NOT NULL DEFAULT current_date,
  data_fim date, status text NOT NULL DEFAULT 'aplicada' CHECK (status IN ('aplicada','suspensa','cumprida','anulada')),
  aplicado_por text NOT NULL, aplicado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,contract_id,team_id) REFERENCES app.contracts(tenant_id,id,team_id),
  FOREIGN KEY (tenant_id,occurrence_id) REFERENCES app.contract_occurrences(tenant_id,id), CHECK (btrim(fundamento)<>'')
);

CREATE TABLE app.contract_executions (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, contract_id uuid NOT NULL,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','medicao','recebimento','financeiro')),
  referencia_id text NOT NULL DEFAULT '', data_execucao date NOT NULL DEFAULT current_date,
  valor numeric(18,2) NOT NULL CHECK (valor > 0), descricao text NOT NULL DEFAULT '',
  registrado_por text NOT NULL, registrado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,contract_id,team_id) REFERENCES app.contracts(tenant_id,id,team_id)
);

CREATE TABLE app.contract_decisions (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, contract_id uuid NOT NULL,
  acao text NOT NULL, status_anterior text NOT NULL, status_novo text NOT NULL, justificativa text NOT NULL DEFAULT '',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, decidido_por text NOT NULL, decidido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,contract_id,team_id) REFERENCES app.contracts(tenant_id,id,team_id)
);

CREATE INDEX contracts_status_idx ON app.contracts(tenant_id,team_id,status,data_fim);
CREATE INDEX contract_responsibles_idx ON app.contract_responsibles(tenant_id,team_id,contract_id,papel);
CREATE INDEX contract_occurrences_idx ON app.contract_occurrences(tenant_id,team_id,contract_id,status,data_ocorrencia DESC);
CREATE INDEX contract_executions_idx ON app.contract_executions(tenant_id,team_id,contract_id,data_execucao DESC);

CREATE OR REPLACE FUNCTION app.validar_origem_contrato() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app.procurement_processes p WHERE p.tenant_id=NEW.tenant_id AND p.team_id=NEW.team_id AND p.id=NEW.process_id AND p.status IN ('aprovada','pedido_emitido','concluida')) THEN
    RAISE EXCEPTION 'somente processo aprovado origina contrato' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.procurement_quotes q WHERE q.tenant_id=NEW.tenant_id AND q.team_id=NEW.team_id AND q.process_id=NEW.process_id AND q.supplier_id=NEW.supplier_id AND q.status='vencedora') THEN
    RAISE EXCEPTION 'contratado precisa ser vencedor do processo' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER contracts_origin BEFORE INSERT OR UPDATE OF process_id,supplier_id ON app.contracts FOR EACH ROW EXECUTE FUNCTION app.validar_origem_contrato();

CREATE OR REPLACE FUNCTION app.bloquear_historico_contratos() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.contract_test_cleanup',true)='autorizado' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'histórico contratual é imutável' USING ERRCODE='55000';
END; $$;
CREATE TRIGGER contract_amendments_immutable BEFORE UPDATE OR DELETE ON app.contract_amendments FOR EACH ROW EXECUTE FUNCTION app.bloquear_historico_contratos();
CREATE TRIGGER contract_sanctions_immutable BEFORE UPDATE OR DELETE ON app.contract_sanctions FOR EACH ROW EXECUTE FUNCTION app.bloquear_historico_contratos();
CREATE TRIGGER contract_executions_immutable BEFORE UPDATE OR DELETE ON app.contract_executions FOR EACH ROW EXECUTE FUNCTION app.bloquear_historico_contratos();
CREATE TRIGGER contract_decisions_immutable BEFORE UPDATE OR DELETE ON app.contract_decisions FOR EACH ROW EXECUTE FUNCTION app.bloquear_historico_contratos();

ALTER TABLE app.contracts ENABLE ROW LEVEL SECURITY; ALTER TABLE app.contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE app.contract_responsibles ENABLE ROW LEVEL SECURITY; ALTER TABLE app.contract_responsibles FORCE ROW LEVEL SECURITY;
ALTER TABLE app.contract_amendments ENABLE ROW LEVEL SECURITY; ALTER TABLE app.contract_amendments FORCE ROW LEVEL SECURITY;
ALTER TABLE app.contract_guarantees ENABLE ROW LEVEL SECURITY; ALTER TABLE app.contract_guarantees FORCE ROW LEVEL SECURITY;
ALTER TABLE app.contract_occurrences ENABLE ROW LEVEL SECURITY; ALTER TABLE app.contract_occurrences FORCE ROW LEVEL SECURITY;
ALTER TABLE app.contract_sanctions ENABLE ROW LEVEL SECURITY; ALTER TABLE app.contract_sanctions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.contract_executions ENABLE ROW LEVEL SECURITY; ALTER TABLE app.contract_executions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.contract_decisions ENABLE ROW LEVEL SECURITY; ALTER TABLE app.contract_decisions FORCE ROW LEVEL SECURITY;

CREATE POLICY contracts_isolation ON app.contracts FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY contract_responsibles_isolation ON app.contract_responsibles FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY contract_amendments_isolation ON app.contract_amendments FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY contract_guarantees_isolation ON app.contract_guarantees FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY contract_occurrences_isolation ON app.contract_occurrences FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY contract_sanctions_isolation ON app.contract_sanctions FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY contract_executions_isolation ON app.contract_executions FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY contract_decisions_isolation ON app.contract_decisions FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);

GRANT SELECT,INSERT,UPDATE ON app.contracts TO prumo_api;
GRANT SELECT,INSERT ON app.contract_responsibles,app.contract_amendments,app.contract_guarantees,app.contract_occurrences,app.contract_sanctions,app.contract_executions,app.contract_decisions TO prumo_api;

CREATE OR REPLACE FUNCTION app.limpar_contratos_tenant_teste(p_tenant_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE equipe record; total integer:=0; removidos integer:=0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app.tenants WHERE id=p_tenant_id AND nome LIKE 'Teste %') THEN RAISE EXCEPTION 'limpeza permitida somente para organizações de teste' USING ERRCODE='42501'; END IF;
  PERFORM set_config('app.tenant_id',p_tenant_id::text,true); PERFORM set_config('app.contract_test_cleanup','autorizado',true);
  FOR equipe IN SELECT id FROM app.teams WHERE tenant_id=p_tenant_id LOOP
    PERFORM set_config('app.team_id',equipe.id::text,true);
    DELETE FROM app.contract_decisions WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS removidos=ROW_COUNT; total:=total+removidos;
    DELETE FROM app.contract_sanctions WHERE tenant_id=p_tenant_id; DELETE FROM app.contract_executions WHERE tenant_id=p_tenant_id;
    DELETE FROM app.contract_occurrences WHERE tenant_id=p_tenant_id; DELETE FROM app.contract_guarantees WHERE tenant_id=p_tenant_id;
    DELETE FROM app.contract_amendments WHERE tenant_id=p_tenant_id; DELETE FROM app.contract_responsibles WHERE tenant_id=p_tenant_id;
    DELETE FROM app.contracts WHERE tenant_id=p_tenant_id;
  END LOOP; RETURN total;
END; $$;
REVOKE ALL ON FUNCTION app.limpar_contratos_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_contratos_tenant_teste(uuid) TO prumo_migrator;
