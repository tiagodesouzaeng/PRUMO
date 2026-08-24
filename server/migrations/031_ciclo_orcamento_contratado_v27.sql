-- Sprint 27: orçamento publicado imutável, base contratada e solicitação de aditivo da obra.
INSERT INTO app.permissions(id,module_id,descricao) VALUES
  ('orcamento.contratar','orcamentos','Homologar resultado da licitação e criar a base contratada'),
  ('orcamento.analisar-aditivo','orcamentos','Analisar solicitações de aditivo encaminhadas pelas obras'),
  ('obras.solicitar-aditivo','obras','Elaborar e submeter solicitações de aditivo')
ON CONFLICT(id) DO UPDATE SET module_id=EXCLUDED.module_id,descricao=EXCLUDED.descricao;
INSERT INTO app.default_profile_permissions(perfil_id,permission_id) SELECT 'administrador',id FROM app.permissions WHERE id IN('orcamento.contratar','orcamento.analisar-aditivo','obras.solicitar-aditivo') ON CONFLICT DO NOTHING;
INSERT INTO app.default_profile_permissions(perfil_id,permission_id) VALUES
  ('gestor','orcamento.contratar'),('gestor','orcamento.analisar-aditivo'),('gestor','obras.solicitar-aditivo'),
  ('orcamentista','orcamento.contratar'),('orcamentista','orcamento.analisar-aditivo'),
  ('fiscal','obras.solicitar-aditivo'),('aprovador','orcamento.analisar-aditivo') ON CONFLICT DO NOTHING;

UPDATE app.module_catalog_versions SET status='substituida' WHERE status='publicada';
INSERT INTO app.module_catalog_versions(versao,status,descricao,criado_por) VALUES(12,'publicada','Catálogo modular PRUMO 27.0','migracao-031');
INSERT INTO app.module_capabilities(module_id,capability_id,nome,versao_catalogo,status) VALUES
  ('orcamentos','base-contratada','Base contratada homologada sem alteração do orçamento publicado',12,'ativa'),
  ('orcamentos','engenharia-custos-aditivos','Análise de solicitações de aditivo pela engenharia de custos',12,'ativa'),
  ('obras','solicitacoes-aditivo','Solicitações de aditivo originadas na fiscalização',12,'ativa'),
  ('medicoes','medicao-base-contratada','Medições limitadas à base contratada vigente',12,'ativa') ON CONFLICT DO NOTHING;
INSERT INTO app.module_dependencies(module_id,depends_on_module_id,obrigatoria) VALUES('obras','contratos',true),('obras','orcamentos',true),('medicoes','orcamentos',true) ON CONFLICT(module_id,depends_on_module_id) DO UPDATE SET obrigatoria=EXCLUDED.obrigatoria;

CREATE TABLE app.budget_contract_baselines(
  tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
  budget_id uuid NOT NULL, revision_id uuid, procurement_process_id uuid, contract_id uuid,
  supplier_name text NOT NULL, published_total numeric(18,2) NOT NULL CHECK(published_total>0),
  discount_percent numeric(9,6) NOT NULL DEFAULT 0 CHECK(discount_percent>=0 AND discount_percent<100),
  contracted_total numeric(18,2) NOT NULL CHECK(contracted_total>0 AND contracted_total<=published_total),
  items jsonb NOT NULL CHECK(jsonb_typeof(items)='array' AND jsonb_array_length(items)>0),
  justification text NOT NULL, status text NOT NULL DEFAULT 'homologada' CHECK(status='homologada'),
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,id,team_id),
  FOREIGN KEY(tenant_id,budget_id) REFERENCES app.orcamentos(tenant_id,id),
  FOREIGN KEY(tenant_id,revision_id) REFERENCES app.orcamento_revisoes(tenant_id,id),
  FOREIGN KEY(tenant_id,procurement_process_id,team_id) REFERENCES app.procurement_processes(tenant_id,id,team_id),
  FOREIGN KEY(tenant_id,contract_id,team_id) REFERENCES app.contracts(tenant_id,id,team_id),
  FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id), CHECK(btrim(supplier_name)<>'' AND length(btrim(justification))>=3)
);
CREATE INDEX budget_contract_baselines_budget_idx ON app.budget_contract_baselines(tenant_id,team_id,budget_id,created_at DESC);

CREATE TABLE app.work_change_requests(
  tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
  work_id uuid NOT NULL, baseline_id uuid NOT NULL, number integer NOT NULL CHECK(number>0),
  type text NOT NULL CHECK(type IN('aditivo_valor','supressao','prazo','reequilibrio','outro')),
  description text NOT NULL, justification text NOT NULL, impact_value numeric(18,2) NOT NULL DEFAULT 0, impact_days integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho' CHECK(status IN('rascunho','submetida','em_analise','aprovada','rejeitada','convertida')),
  cost_opinion text NOT NULL DEFAULT '', version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  created_by text NOT NULL, updated_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,id,team_id), UNIQUE(tenant_id,work_id,number),
  FOREIGN KEY(tenant_id,work_id) REFERENCES app.empreendimentos(tenant_id,id),
  FOREIGN KEY(tenant_id,baseline_id,team_id) REFERENCES app.budget_contract_baselines(tenant_id,id,team_id),
  FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id), CHECK(length(btrim(description))>=3 AND length(btrim(justification))>=3)
);
CREATE INDEX work_change_requests_status_idx ON app.work_change_requests(tenant_id,team_id,status,updated_at DESC);

CREATE TABLE app.work_change_request_decisions(
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, request_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN('submeter','iniciar_analise','aprovar','rejeitar','converter')),
  previous_status text NOT NULL, new_status text NOT NULL, opinion text NOT NULL DEFAULT '', decided_by text NOT NULL, decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,request_id,team_id) REFERENCES app.work_change_requests(tenant_id,id,team_id), FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id)
);

CREATE OR REPLACE FUNCTION app.block_contract_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'histórico contratual é imutável' USING ERRCODE='55000'; END; $$;
CREATE TRIGGER budget_contract_baselines_immutable BEFORE UPDATE OR DELETE ON app.budget_contract_baselines FOR EACH ROW EXECUTE FUNCTION app.block_contract_history();
CREATE TRIGGER work_change_request_decisions_immutable BEFORE UPDATE OR DELETE ON app.work_change_request_decisions FOR EACH ROW EXECUTE FUNCTION app.block_contract_history();
ALTER TABLE app.budget_contract_baselines ENABLE ROW LEVEL SECURITY; ALTER TABLE app.budget_contract_baselines FORCE ROW LEVEL SECURITY;
ALTER TABLE app.work_change_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE app.work_change_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE app.work_change_request_decisions ENABLE ROW LEVEL SECURITY; ALTER TABLE app.work_change_request_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY budget_contract_baselines_isolation ON app.budget_contract_baselines FOR ALL USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY work_change_requests_isolation ON app.work_change_requests FOR ALL USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY work_change_request_decisions_isolation ON app.work_change_request_decisions FOR ALL USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
GRANT SELECT,INSERT ON app.budget_contract_baselines TO prumo_api;
GRANT SELECT,INSERT,UPDATE ON app.work_change_requests TO prumo_api;
GRANT SELECT,INSERT ON app.work_change_request_decisions TO prumo_api;
