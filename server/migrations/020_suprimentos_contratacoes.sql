INSERT INTO app.permissions (id, module_id, descricao) VALUES
  ('suprimentos.cotar', 'suprimentos', 'Registrar pesquisa de preços e propostas'),
  ('suprimentos.julgar', 'suprimentos', 'Analisar e classificar propostas'),
  ('suprimentos.aprovar', 'suprimentos', 'Aprovar contratações e emitir pedidos'),
  ('suprimentos.receber', 'suprimentos', 'Registrar recebimentos e aceite')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, descricao = EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id)
SELECT 'administrador', id FROM app.permissions WHERE id LIKE 'suprimentos.%'
ON CONFLICT DO NOTHING;
INSERT INTO app.default_profile_permissions (perfil_id, permission_id) VALUES
  ('gestor', 'suprimentos.cotar'), ('gestor', 'suprimentos.julgar'),
  ('gestor', 'suprimentos.aprovar'), ('gestor', 'suprimentos.receber'),
  ('orcamentista', 'suprimentos.cotar'),
  ('fiscal', 'suprimentos.consultar'), ('fiscal', 'suprimentos.receber'),
  ('aprovador', 'suprimentos.consultar'), ('aprovador', 'suprimentos.aprovar'),
  ('consulta', 'suprimentos.consultar')
ON CONFLICT DO NOTHING;

UPDATE app.module_catalog_versions SET status = 'substituida' WHERE status = 'publicada';
INSERT INTO app.module_catalog_versions (versao, status, descricao, criado_por)
VALUES (4, 'publicada', 'Catálogo modular PRUMO 13.0', 'migracao-020');
INSERT INTO app.module_capabilities (module_id, capability_id, nome, versao_catalogo, status) VALUES
  ('suprimentos', 'fornecedores-compartilhados', 'Fornecedores compartilhados e qualificados', 4, 'ativa'),
  ('suprimentos', 'planejamento-contratacao', 'Estudo técnico, riscos e termo de referência', 4, 'ativa'),
  ('suprimentos', 'pesquisa-julgamento', 'Pesquisa de preços, propostas e julgamento', 4, 'ativa'),
  ('suprimentos', 'pedidos-recebimentos', 'Pedidos, recebimentos e aceite', 4, 'ativa')
ON CONFLICT DO NOTHING;
INSERT INTO app.module_dependencies (module_id, depends_on_module_id, obrigatoria) VALUES
  ('suprimentos', 'planejamento', true),
  ('suprimentos', 'orcamentos', false)
ON CONFLICT (module_id, depends_on_module_id) DO UPDATE SET obrigatoria = EXCLUDED.obrigatoria;

CREATE TABLE app.suppliers (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
  codigo text NOT NULL, razao_social text NOT NULL, nome_fantasia text NOT NULL DEFAULT '',
  documento text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', telefone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','suspenso','inativo')),
  qualificacao text NOT NULL DEFAULT 'pendente' CHECK (qualificacao IN ('pendente','qualificado','restrito')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_por text NOT NULL, atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id), UNIQUE (tenant_id,team_id,codigo),
  FOREIGN KEY (tenant_id,team_id) REFERENCES app.teams(tenant_id,id),
  CHECK (btrim(codigo) <> '' AND btrim(razao_social) <> '')
);
CREATE UNIQUE INDEX suppliers_documento_unique ON app.suppliers (tenant_id,team_id,documento) WHERE documento <> '';

CREATE TABLE app.procurement_processes (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
  demand_id uuid, orcamento_id uuid, codigo text NOT NULL, titulo text NOT NULL, objeto text NOT NULL,
  tipo text NOT NULL DEFAULT 'servico' CHECK (tipo IN ('material','servico','obra','solucao_integrada')),
  regime text NOT NULL DEFAULT 'publico' CHECK (regime IN ('publico','federacao','privado')),
  criterio_julgamento text NOT NULL DEFAULT 'menor_preco' CHECK (criterio_julgamento IN ('menor_preco','maior_desconto','tecnica_preco','melhor_tecnica')),
  valor_estimado numeric(18,2) NOT NULL DEFAULT 0 CHECK (valor_estimado >= 0),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','planejamento','pesquisa_precos','selecao','aprovada','pedido_emitido','concluida','cancelada')),
  estudo_tecnico jsonb NOT NULL DEFAULT '{}'::jsonb, riscos jsonb NOT NULL DEFAULT '[]'::jsonb,
  termo_referencia jsonb NOT NULL DEFAULT '{}'::jsonb, dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0), criado_por text NOT NULL, atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id), UNIQUE (tenant_id,team_id,codigo),
  FOREIGN KEY (tenant_id,team_id) REFERENCES app.teams(tenant_id,id),
  FOREIGN KEY (tenant_id,demand_id,team_id) REFERENCES app.investment_demands(tenant_id,id,team_id),
  FOREIGN KEY (tenant_id,orcamento_id) REFERENCES app.orcamentos(tenant_id,id),
  CHECK (btrim(codigo) <> '' AND btrim(titulo) <> '' AND btrim(objeto) <> ''),
  CHECK (demand_id IS NOT NULL OR orcamento_id IS NOT NULL)
);

CREATE TABLE app.procurement_quotes (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, process_id uuid NOT NULL, supplier_id uuid NOT NULL,
  data_proposta date NOT NULL DEFAULT current_date, validade_dias integer NOT NULL DEFAULT 30 CHECK (validade_dias >= 0),
  prazo_entrega_dias integer NOT NULL DEFAULT 0 CHECK (prazo_entrega_dias >= 0), valor_total numeric(18,2) NOT NULL CHECK (valor_total > 0),
  status text NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida','classificada','desclassificada','vencedora')),
  justificativa text NOT NULL DEFAULT '', proposta jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,process_id,supplier_id),
  FOREIGN KEY (tenant_id,process_id,team_id) REFERENCES app.procurement_processes(tenant_id,id,team_id),
  FOREIGN KEY (tenant_id,supplier_id,team_id) REFERENCES app.suppliers(tenant_id,id,team_id)
);

CREATE TABLE app.procurement_decisions (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, process_id uuid NOT NULL,
  acao text NOT NULL, status_anterior text NOT NULL, status_novo text NOT NULL,
  justificativa text NOT NULL DEFAULT '', dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  decidido_por text NOT NULL, decidido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,process_id,team_id) REFERENCES app.procurement_processes(tenant_id,id,team_id)
);

CREATE TABLE app.purchase_orders (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, process_id uuid NOT NULL,
  supplier_id uuid NOT NULL, quote_id uuid, codigo text NOT NULL, valor_total numeric(18,2) NOT NULL CHECK (valor_total > 0),
  data_emissao date NOT NULL DEFAULT current_date, data_prevista date,
  status text NOT NULL DEFAULT 'emitido' CHECK (status IN ('emitido','parcial','recebido','cancelado')),
  valor_recebido numeric(18,2) NOT NULL DEFAULT 0 CHECK (valor_recebido >= 0), dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0), criado_por text NOT NULL, atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id), UNIQUE (tenant_id,team_id,codigo),
  FOREIGN KEY (tenant_id,process_id,team_id) REFERENCES app.procurement_processes(tenant_id,id,team_id),
  FOREIGN KEY (tenant_id,supplier_id,team_id) REFERENCES app.suppliers(tenant_id,id,team_id),
  FOREIGN KEY (tenant_id,quote_id) REFERENCES app.procurement_quotes(tenant_id,id),
  CHECK (valor_recebido <= valor_total)
);

CREATE TABLE app.purchase_receipts (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, order_id uuid NOT NULL,
  data_recebimento date NOT NULL DEFAULT current_date, valor_recebido numeric(18,2) NOT NULL CHECK (valor_recebido > 0),
  aceite text NOT NULL DEFAULT 'aceito' CHECK (aceite IN ('aceito','aceito_com_ressalva','rejeitado')),
  observacao text NOT NULL DEFAULT '', recebido_por text NOT NULL, recebido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,order_id,team_id) REFERENCES app.purchase_orders(tenant_id,id,team_id)
);

CREATE INDEX procurement_process_status_idx ON app.procurement_processes (tenant_id,team_id,status,atualizado_em DESC);
CREATE INDEX procurement_quotes_process_idx ON app.procurement_quotes (tenant_id,team_id,process_id,valor_total);
CREATE INDEX purchase_orders_process_idx ON app.purchase_orders (tenant_id,team_id,process_id,status);
CREATE INDEX purchase_receipts_order_idx ON app.purchase_receipts (tenant_id,team_id,order_id,recebido_em DESC);

CREATE OR REPLACE FUNCTION app.validar_origem_contratacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.demand_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app.investment_demands d WHERE d.tenant_id=NEW.tenant_id AND d.team_id=NEW.team_id AND d.id=NEW.demand_id AND d.status='incorporada') THEN
    RAISE EXCEPTION 'somente demandas incorporadas originam contratação' USING ERRCODE='23514';
  END IF;
  IF NEW.orcamento_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app.orcamentos o WHERE o.tenant_id=NEW.tenant_id AND o.team_id=NEW.team_id AND o.id=NEW.orcamento_id) THEN
    RAISE EXCEPTION 'o orçamento precisa pertencer à equipe da contratação' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER procurement_process_origin BEFORE INSERT OR UPDATE OF demand_id,orcamento_id ON app.procurement_processes FOR EACH ROW EXECUTE FUNCTION app.validar_origem_contratacao();

CREATE OR REPLACE FUNCTION app.bloquear_historico_suprimentos() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.procurement_test_cleanup',true)='autorizado' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'histórico de suprimentos é imutável' USING ERRCODE='55000';
END; $$;
CREATE TRIGGER procurement_decisions_immutable BEFORE UPDATE OR DELETE ON app.procurement_decisions FOR EACH ROW EXECUTE FUNCTION app.bloquear_historico_suprimentos();
CREATE TRIGGER purchase_receipts_immutable BEFORE UPDATE OR DELETE ON app.purchase_receipts FOR EACH ROW EXECUTE FUNCTION app.bloquear_historico_suprimentos();

ALTER TABLE app.suppliers ENABLE ROW LEVEL SECURITY; ALTER TABLE app.suppliers FORCE ROW LEVEL SECURITY;
ALTER TABLE app.procurement_processes ENABLE ROW LEVEL SECURITY; ALTER TABLE app.procurement_processes FORCE ROW LEVEL SECURITY;
ALTER TABLE app.procurement_quotes ENABLE ROW LEVEL SECURITY; ALTER TABLE app.procurement_quotes FORCE ROW LEVEL SECURITY;
ALTER TABLE app.procurement_decisions ENABLE ROW LEVEL SECURITY; ALTER TABLE app.procurement_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.purchase_orders ENABLE ROW LEVEL SECURITY; ALTER TABLE app.purchase_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE app.purchase_receipts ENABLE ROW LEVEL SECURITY; ALTER TABLE app.purchase_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY suppliers_isolation ON app.suppliers FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY procurement_processes_isolation ON app.procurement_processes FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY procurement_quotes_isolation ON app.procurement_quotes FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY procurement_decisions_isolation ON app.procurement_decisions FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY purchase_orders_isolation ON app.purchase_orders FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY purchase_receipts_isolation ON app.purchase_receipts FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);

GRANT SELECT,INSERT,UPDATE ON app.suppliers,app.procurement_processes,app.purchase_orders TO prumo_api;
GRANT SELECT,INSERT,UPDATE ON app.procurement_quotes TO prumo_api;
GRANT SELECT,INSERT ON app.procurement_decisions,app.purchase_receipts TO prumo_api;

CREATE OR REPLACE FUNCTION app.limpar_suprimentos_tenant_teste(p_tenant_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE equipe record; total integer:=0; removidos integer:=0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app.tenants WHERE id=p_tenant_id AND nome LIKE 'Teste %') THEN RAISE EXCEPTION 'limpeza permitida somente para organizações de teste' USING ERRCODE='42501'; END IF;
  PERFORM set_config('app.tenant_id',p_tenant_id::text,true); PERFORM set_config('app.procurement_test_cleanup','autorizado',true);
  FOR equipe IN SELECT id FROM app.teams WHERE tenant_id=p_tenant_id LOOP
    PERFORM set_config('app.team_id',equipe.id::text,true);
    DELETE FROM app.purchase_receipts WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS removidos=ROW_COUNT; total:=total+removidos;
    DELETE FROM app.purchase_orders WHERE tenant_id=p_tenant_id; DELETE FROM app.procurement_decisions WHERE tenant_id=p_tenant_id;
    DELETE FROM app.procurement_quotes WHERE tenant_id=p_tenant_id; DELETE FROM app.procurement_processes WHERE tenant_id=p_tenant_id; DELETE FROM app.suppliers WHERE tenant_id=p_tenant_id;
  END LOOP; RETURN total;
END; $$;
REVOKE ALL ON FUNCTION app.limpar_suprimentos_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_suprimentos_tenant_teste(uuid) TO prumo_migrator;
