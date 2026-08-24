INSERT INTO app.modules (id, nome, ordem) VALUES
  ('financeiro', 'Financeiro-Orçamentário', 58)
ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, ordem=EXCLUDED.ordem, status='ativo';

DO $$
DECLARE empresa record; total_modulos integer;
BEGIN
  FOR empresa IN SELECT id FROM app.tenants LOOP
    PERFORM set_config('app.tenant_id',empresa.id::text,true);
    SELECT count(*)::integer INTO total_modulos FROM app.tenant_modules WHERE tenant_id=empresa.id;
    IF total_modulos > 0 THEN
      INSERT INTO app.tenant_modules (tenant_id,module_id,status) VALUES (empresa.id,'financeiro','ativo') ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO app.tenant_module_contracts (tenant_id,module_id,atualizado_por) VALUES (empresa.id,'financeiro','migracao-022') ON CONFLICT DO NOTHING;
  END LOOP;
  PERFORM set_config('app.tenant_id','',true);
END; $$;

INSERT INTO app.permissions (id,module_id,descricao) VALUES
  ('financeiro.consultar','financeiro','Consultar orçamento e execução financeira'),
  ('financeiro.planejar','financeiro','Gerir centros de custo, fontes e orçamento anual'),
  ('financeiro.comprometer','financeiro','Reservar e comprometer recursos'),
  ('financeiro.liquidar','financeiro','Liquidar despesas, retenções e glosas'),
  ('financeiro.pagar','financeiro','Registrar pagamentos autorizados'),
  ('financeiro.conciliar','financeiro','Conciliar movimentos com sistemas externos')
ON CONFLICT (id) DO UPDATE SET module_id=EXCLUDED.module_id, descricao=EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions (perfil_id,permission_id)
SELECT 'administrador',id FROM app.permissions WHERE id LIKE 'financeiro.%' ON CONFLICT DO NOTHING;
INSERT INTO app.default_profile_permissions (perfil_id,permission_id) VALUES
  ('gestor','financeiro.consultar'),('gestor','financeiro.planejar'),('gestor','financeiro.comprometer'),('gestor','financeiro.liquidar'),
  ('fiscal','financeiro.consultar'),('fiscal','financeiro.liquidar'),
  ('aprovador','financeiro.consultar'),('aprovador','financeiro.comprometer'),('aprovador','financeiro.liquidar'),('aprovador','financeiro.pagar'),('aprovador','financeiro.conciliar'),
  ('orcamentista','financeiro.consultar'),('consulta','financeiro.consultar')
ON CONFLICT DO NOTHING;

UPDATE app.module_catalog_versions SET status='substituida' WHERE status='publicada';
INSERT INTO app.module_catalog_versions (versao,status,descricao,criado_por)
VALUES (6,'publicada','Catálogo modular PRUMO 15.0','migracao-022');
INSERT INTO app.module_capabilities (module_id,capability_id,nome,versao_catalogo,status) VALUES
  ('financeiro','planejamento-orcamentario','Centros de custo, fontes e orçamento anual',6,'ativa'),
  ('financeiro','execucao-financeira','Reservas, compromissos, liquidações e pagamentos',6,'ativa'),
  ('financeiro','deducoes-saldos','Retenções, glosas, CAPEX, OPEX e saldos',6,'ativa'),
  ('financeiro','conciliacao-integracoes','Conciliação e referências para integrações externas',6,'ativa')
ON CONFLICT DO NOTHING;
INSERT INTO app.module_dependencies (module_id,depends_on_module_id,obrigatoria) VALUES
  ('financeiro','planejamento',false),('financeiro','suprimentos',false),('financeiro','contratos',false),('financeiro','medicoes',false),('financeiro','documentos',false)
ON CONFLICT (module_id,depends_on_module_id) DO UPDATE SET obrigatoria=EXCLUDED.obrigatoria;

CREATE TABLE app.financial_cost_centers (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
  codigo text NOT NULL, nome text NOT NULL, responsavel text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_por text NOT NULL, atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id), UNIQUE (tenant_id,team_id,codigo),
  FOREIGN KEY (tenant_id,team_id) REFERENCES app.teams(tenant_id,id),
  CHECK (btrim(codigo)<>'' AND btrim(nome)<>'')
);

CREATE TABLE app.financial_funding_sources (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
  codigo text NOT NULL, nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'propria' CHECK (tipo IN ('tesouro','transferencia','convenio','propria','financiamento','outra')),
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','inativa')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_por text NOT NULL, atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id), UNIQUE (tenant_id,team_id,codigo),
  FOREIGN KEY (tenant_id,team_id) REFERENCES app.teams(tenant_id,id),
  CHECK (btrim(codigo)<>'' AND btrim(nome)<>'')
);

CREATE TABLE app.financial_budgets (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
  cost_center_id uuid NOT NULL, funding_source_id uuid NOT NULL,
  codigo text NOT NULL, descricao text NOT NULL, ano integer NOT NULL CHECK (ano BETWEEN 2000 AND 2200),
  classificacao text NOT NULL CHECK (classificacao IN ('capex','opex')),
  valor_inicial numeric(18,2) NOT NULL CHECK (valor_inicial >= 0),
  ajustes numeric(18,2) NOT NULL DEFAULT 0,
  valor_atual numeric(18,2) GENERATED ALWAYS AS (valor_inicial + ajustes) STORED,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','bloqueado','encerrado')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_por text NOT NULL, atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id), UNIQUE (tenant_id,team_id,ano,codigo),
  FOREIGN KEY (tenant_id,cost_center_id,team_id) REFERENCES app.financial_cost_centers(tenant_id,id,team_id),
  FOREIGN KEY (tenant_id,funding_source_id,team_id) REFERENCES app.financial_funding_sources(tenant_id,id,team_id),
  CHECK (btrim(codigo)<>'' AND btrim(descricao)<>'' AND valor_inicial + ajustes >= 0)
);

CREATE TABLE app.financial_commitments (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
  budget_id uuid NOT NULL, codigo text NOT NULL, descricao text NOT NULL,
  origem_tipo text NOT NULL DEFAULT 'manual' CHECK (origem_tipo IN ('manual','pedido','contrato','medicao')),
  origem_id text NOT NULL DEFAULT '', beneficiario text NOT NULL DEFAULT '',
  competencia date NOT NULL, data_vencimento date,
  valor_total numeric(18,2) NOT NULL CHECK (valor_total > 0),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','reservado','comprometido','parcialmente_liquidado','liquidado','parcialmente_pago','pago','cancelado')),
  referencia_externa text NOT NULL DEFAULT '', dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0), criado_por text NOT NULL, atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id), UNIQUE (tenant_id,team_id,codigo),
  FOREIGN KEY (tenant_id,budget_id,team_id) REFERENCES app.financial_budgets(tenant_id,id,team_id),
  CHECK (btrim(codigo)<>'' AND btrim(descricao)<>'' AND (origem_tipo='manual' OR btrim(origem_id)<>''))
);

CREATE TABLE app.financial_movements (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, commitment_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('reserva','compromisso','liquidacao','pagamento','cancelamento')),
  data_movimento date NOT NULL DEFAULT current_date, valor numeric(18,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  retencoes numeric(18,2) NOT NULL DEFAULT 0 CHECK (retencoes >= 0),
  glosas numeric(18,2) NOT NULL DEFAULT 0 CHECK (glosas >= 0),
  valor_liquido numeric(18,2) GENERATED ALWAYS AS (valor-retencoes-glosas) STORED,
  documento text NOT NULL DEFAULT '', referencia_externa text NOT NULL DEFAULT '', justificativa text NOT NULL DEFAULT '',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, registrado_por text NOT NULL, registrado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id),
  FOREIGN KEY (tenant_id,commitment_id,team_id) REFERENCES app.financial_commitments(tenant_id,id,team_id),
  CHECK (retencoes + glosas <= valor)
);

CREATE TABLE app.financial_reconciliations (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, movement_id uuid NOT NULL,
  referencia_externa text NOT NULL, data_conciliacao date NOT NULL DEFAULT current_date,
  status text NOT NULL CHECK (status IN ('conciliado','divergente','pendente')),
  diferenca numeric(18,2) NOT NULL DEFAULT 0, observacao text NOT NULL DEFAULT '',
  conciliado_por text NOT NULL, conciliado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,movement_id,referencia_externa),
  FOREIGN KEY (tenant_id,movement_id,team_id) REFERENCES app.financial_movements(tenant_id,id,team_id),
  CHECK (btrim(referencia_externa)<>'')
);

CREATE INDEX financial_budgets_lookup_idx ON app.financial_budgets(tenant_id,team_id,ano,status);
CREATE INDEX financial_commitments_lookup_idx ON app.financial_commitments(tenant_id,team_id,status,data_vencimento);
CREATE INDEX financial_movements_lookup_idx ON app.financial_movements(tenant_id,team_id,commitment_id,data_movimento DESC);

CREATE OR REPLACE FUNCTION app.bloquear_historico_financeiro() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.financial_test_cleanup',true)='autorizado' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'histórico financeiro é imutável' USING ERRCODE='55000';
END; $$;
CREATE TRIGGER financial_movements_immutable BEFORE UPDATE OR DELETE ON app.financial_movements FOR EACH ROW EXECUTE FUNCTION app.bloquear_historico_financeiro();
CREATE TRIGGER financial_reconciliations_immutable BEFORE UPDATE OR DELETE ON app.financial_reconciliations FOR EACH ROW EXECUTE FUNCTION app.bloquear_historico_financeiro();

ALTER TABLE app.financial_cost_centers ENABLE ROW LEVEL SECURITY; ALTER TABLE app.financial_cost_centers FORCE ROW LEVEL SECURITY;
ALTER TABLE app.financial_funding_sources ENABLE ROW LEVEL SECURITY; ALTER TABLE app.financial_funding_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE app.financial_budgets ENABLE ROW LEVEL SECURITY; ALTER TABLE app.financial_budgets FORCE ROW LEVEL SECURITY;
ALTER TABLE app.financial_commitments ENABLE ROW LEVEL SECURITY; ALTER TABLE app.financial_commitments FORCE ROW LEVEL SECURITY;
ALTER TABLE app.financial_movements ENABLE ROW LEVEL SECURITY; ALTER TABLE app.financial_movements FORCE ROW LEVEL SECURITY;
ALTER TABLE app.financial_reconciliations ENABLE ROW LEVEL SECURITY; ALTER TABLE app.financial_reconciliations FORCE ROW LEVEL SECURITY;

CREATE POLICY financial_cost_centers_isolation ON app.financial_cost_centers FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY financial_funding_sources_isolation ON app.financial_funding_sources FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY financial_budgets_isolation ON app.financial_budgets FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY financial_commitments_isolation ON app.financial_commitments FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY financial_movements_isolation ON app.financial_movements FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY financial_reconciliations_isolation ON app.financial_reconciliations FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);

GRANT SELECT,INSERT,UPDATE ON app.financial_cost_centers,app.financial_funding_sources,app.financial_budgets,app.financial_commitments TO prumo_api;
GRANT SELECT,INSERT ON app.financial_movements,app.financial_reconciliations TO prumo_api;

CREATE OR REPLACE FUNCTION app.limpar_financeiro_tenant_teste(p_tenant_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE equipe record; total integer:=0; removidos integer:=0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app.tenants WHERE id=p_tenant_id AND nome LIKE 'Teste %') THEN RAISE EXCEPTION 'limpeza permitida somente para organizações de teste' USING ERRCODE='42501'; END IF;
  PERFORM set_config('app.tenant_id',p_tenant_id::text,true); PERFORM set_config('app.financial_test_cleanup','autorizado',true);
  FOR equipe IN SELECT id FROM app.teams WHERE tenant_id=p_tenant_id LOOP
    PERFORM set_config('app.team_id',equipe.id::text,true);
    DELETE FROM app.financial_reconciliations WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS removidos=ROW_COUNT; total:=total+removidos;
    DELETE FROM app.financial_movements WHERE tenant_id=p_tenant_id; DELETE FROM app.financial_commitments WHERE tenant_id=p_tenant_id;
    DELETE FROM app.financial_budgets WHERE tenant_id=p_tenant_id; DELETE FROM app.financial_funding_sources WHERE tenant_id=p_tenant_id;
    DELETE FROM app.financial_cost_centers WHERE tenant_id=p_tenant_id;
  END LOOP; RETURN total;
END; $$;
REVOKE ALL ON FUNCTION app.limpar_financeiro_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_financeiro_tenant_teste(uuid) TO prumo_migrator;
