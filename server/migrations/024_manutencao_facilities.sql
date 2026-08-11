INSERT INTO app.permissions (id,module_id,descricao) VALUES
  ('manutencao.planejar','manutencao','Gerir planos preventivos'),
  ('manutencao.atender','manutencao','Triar chamados e executar ordens de serviço'),
  ('manutencao.encerrar','manutencao','Aceitar, encerrar ou cancelar atendimentos')
ON CONFLICT (id) DO UPDATE SET module_id=EXCLUDED.module_id, descricao=EXCLUDED.descricao;
INSERT INTO app.default_profile_permissions (perfil_id,permission_id)
SELECT 'administrador',id FROM app.permissions WHERE id LIKE 'manutencao.%' ON CONFLICT DO NOTHING;
INSERT INTO app.default_profile_permissions (perfil_id,permission_id) VALUES
  ('gestor','manutencao.consultar'),('gestor','manutencao.planejar'),('gestor','manutencao.atender'),('gestor','manutencao.encerrar'),
  ('fiscal','manutencao.consultar'),('fiscal','manutencao.atender'),
  ('aprovador','manutencao.consultar'),('aprovador','manutencao.encerrar'),('consulta','manutencao.consultar')
ON CONFLICT DO NOTHING;

UPDATE app.module_catalog_versions SET status='substituida' WHERE status='publicada';
INSERT INTO app.module_catalog_versions (versao,status,descricao,criado_por)
VALUES (8,'publicada','Catálogo modular PRUMO 17.0','migracao-024');
INSERT INTO app.module_capabilities (module_id,capability_id,nome,versao_catalogo,status) VALUES
  ('manutencao','chamados-sla','Chamados corretivos com prioridade, SLA e aceite',8,'ativa'),
  ('manutencao','planos-preventivos','Planos preventivos ligados a ativos e espaços',8,'ativa'),
  ('manutencao','ordens-recursos-custos','Ordens, equipes, fornecedores, recursos e custos',8,'ativa')
ON CONFLICT DO NOTHING;
INSERT INTO app.module_dependencies (module_id,depends_on_module_id,obrigatoria) VALUES
  ('manutencao','patrimonio',true),('manutencao','suprimentos',false),('manutencao','contratos',false),('manutencao','financeiro',false),('manutencao','documentos',false)
ON CONFLICT (module_id,depends_on_module_id) DO UPDATE SET obrigatoria=EXCLUDED.obrigatoria;

CREATE TABLE app.maintenance_plans (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
  patrimonio_unidade_id uuid, ativo_id uuid, codigo text NOT NULL, nome text NOT NULL,
  especialidade text NOT NULL DEFAULT 'predial', periodicidade_dias integer NOT NULL CHECK (periodicidade_dias>0),
  proxima_execucao date NOT NULL, responsavel text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','suspenso','encerrado')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, versao bigint NOT NULL DEFAULT 1 CHECK (versao>0),
  criado_por text NOT NULL, atualizado_por text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id), UNIQUE (tenant_id,team_id,codigo),
  FOREIGN KEY (tenant_id,team_id) REFERENCES app.teams(tenant_id,id),
  FOREIGN KEY (tenant_id,patrimonio_unidade_id) REFERENCES app.patrimonial_units(tenant_id,id),
  FOREIGN KEY (tenant_id,ativo_id,team_id) REFERENCES app.patrimonial_assets(tenant_id,id,team_id),
  CHECK (patrimonio_unidade_id IS NOT NULL OR ativo_id IS NOT NULL)
);

CREATE TABLE app.maintenance_tickets (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
  patrimonio_unidade_id uuid NOT NULL, ativo_id uuid, plano_id uuid, codigo text NOT NULL, titulo text NOT NULL,
  descricao text NOT NULL, tipo text NOT NULL DEFAULT 'corretiva' CHECK (tipo IN ('corretiva','preventiva','inspecao','melhoria')),
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('critica','alta','media','baixa')),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','triado','programado','em_atendimento','resolvido','fechado','cancelado')),
  solicitante text NOT NULL DEFAULT '', responsavel text NOT NULL DEFAULT '', aberto_em timestamptz NOT NULL DEFAULT now(),
  sla_vencimento timestamptz NOT NULL, resolvido_em timestamptz, fechado_em timestamptz,
  solucao text NOT NULL DEFAULT '', aceite text NOT NULL DEFAULT '', dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao bigint NOT NULL DEFAULT 1 CHECK (versao>0), criado_por text NOT NULL, atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id), UNIQUE (tenant_id,team_id,codigo),
  FOREIGN KEY (tenant_id,team_id) REFERENCES app.teams(tenant_id,id),
  FOREIGN KEY (tenant_id,patrimonio_unidade_id) REFERENCES app.patrimonial_units(tenant_id,id),
  FOREIGN KEY (tenant_id,ativo_id,team_id) REFERENCES app.patrimonial_assets(tenant_id,id,team_id),
  FOREIGN KEY (tenant_id,plano_id,team_id) REFERENCES app.maintenance_plans(tenant_id,id,team_id),
  CHECK (btrim(codigo)<>'' AND btrim(titulo)<>'' AND btrim(descricao)<>'')
);

CREATE TABLE app.maintenance_work_orders (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, ticket_id uuid NOT NULL,
  codigo text NOT NULL, equipe text NOT NULL DEFAULT '', fornecedor_id uuid,
  data_programada date, iniciado_em timestamptz, concluido_em timestamptz,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','programada','em_execucao','concluida','cancelada')),
  diagnostico text NOT NULL DEFAULT '', servico_executado text NOT NULL DEFAULT '', custo_total numeric(18,2) NOT NULL DEFAULT 0 CHECK (custo_total>=0),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, versao bigint NOT NULL DEFAULT 1 CHECK (versao>0),
  criado_por text NOT NULL, atualizado_por text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id), UNIQUE (tenant_id,team_id,codigo),
  FOREIGN KEY (tenant_id,ticket_id,team_id) REFERENCES app.maintenance_tickets(tenant_id,id,team_id),
  FOREIGN KEY (tenant_id,fornecedor_id,team_id) REFERENCES app.suppliers(tenant_id,id,team_id)
);

CREATE TABLE app.maintenance_resources (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, work_order_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('material','mao_obra','equipamento','servico')),
  descricao text NOT NULL, unidade text NOT NULL DEFAULT '', quantidade numeric(18,4) NOT NULL CHECK (quantidade>0),
  valor_unitario numeric(18,4) NOT NULL DEFAULT 0 CHECK (valor_unitario>=0),
  valor_total numeric(18,2) GENERATED ALWAYS AS (trunc(quantidade*valor_unitario,2)) STORED,
  registrado_por text NOT NULL, registrado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,work_order_id,team_id) REFERENCES app.maintenance_work_orders(tenant_id,id,team_id),
  FOREIGN KEY (tenant_id,team_id) REFERENCES app.teams(tenant_id,id), CHECK (btrim(descricao)<>'')
);

CREATE TABLE app.maintenance_decisions (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, ticket_id uuid NOT NULL,
  acao text NOT NULL, status_anterior text NOT NULL, status_novo text NOT NULL, justificativa text NOT NULL DEFAULT '',
  decidido_por text NOT NULL, decidido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,ticket_id,team_id) REFERENCES app.maintenance_tickets(tenant_id,id,team_id)
);

CREATE INDEX maintenance_tickets_sla_idx ON app.maintenance_tickets(tenant_id,team_id,status,sla_vencimento);
CREATE INDEX maintenance_plans_schedule_idx ON app.maintenance_plans(tenant_id,team_id,status,proxima_execucao);
CREATE INDEX maintenance_orders_status_idx ON app.maintenance_work_orders(tenant_id,team_id,status,data_programada);

CREATE OR REPLACE FUNCTION app.bloquear_historico_manutencao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'histórico de manutenção é imutável' USING ERRCODE='55000'; END; $$;
CREATE TRIGGER maintenance_resources_immutable BEFORE UPDATE OR DELETE ON app.maintenance_resources FOR EACH ROW EXECUTE FUNCTION app.bloquear_historico_manutencao();
CREATE TRIGGER maintenance_decisions_immutable BEFORE UPDATE OR DELETE ON app.maintenance_decisions FOR EACH ROW EXECUTE FUNCTION app.bloquear_historico_manutencao();

ALTER TABLE app.maintenance_plans ENABLE ROW LEVEL SECURITY; ALTER TABLE app.maintenance_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE app.maintenance_tickets ENABLE ROW LEVEL SECURITY; ALTER TABLE app.maintenance_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE app.maintenance_work_orders ENABLE ROW LEVEL SECURITY; ALTER TABLE app.maintenance_work_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE app.maintenance_resources ENABLE ROW LEVEL SECURITY; ALTER TABLE app.maintenance_resources FORCE ROW LEVEL SECURITY;
ALTER TABLE app.maintenance_decisions ENABLE ROW LEVEL SECURITY; ALTER TABLE app.maintenance_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY maintenance_plans_isolation ON app.maintenance_plans FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY maintenance_tickets_isolation ON app.maintenance_tickets FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY maintenance_orders_isolation ON app.maintenance_work_orders FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY maintenance_resources_isolation ON app.maintenance_resources FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY maintenance_decisions_isolation ON app.maintenance_decisions FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);

GRANT SELECT,INSERT,UPDATE ON app.maintenance_plans,app.maintenance_tickets,app.maintenance_work_orders TO prumo_api;
GRANT SELECT,INSERT ON app.maintenance_resources,app.maintenance_decisions TO prumo_api;
