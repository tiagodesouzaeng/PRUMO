INSERT INTO app.permissions (id,module_id,descricao) VALUES
  ('obras.consultar','obras','Consultar obras, cronogramas e diários'),
  ('obras.editar','obras','Cadastrar e atualizar obras e cronogramas'),
  ('obras.fiscalizar','obras','Fiscalizar, registrar diário e decidir o fluxo da obra')
ON CONFLICT (id) DO UPDATE SET module_id=EXCLUDED.module_id, descricao=EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions (perfil_id,permission_id)
SELECT 'administrador',id FROM app.permissions WHERE id LIKE 'obras.%' ON CONFLICT DO NOTHING;
INSERT INTO app.default_profile_permissions (perfil_id,permission_id) VALUES
  ('gestor','obras.consultar'),('gestor','obras.editar'),('gestor','obras.fiscalizar'),
  ('fiscal','obras.consultar'),('fiscal','obras.fiscalizar'),
  ('aprovador','obras.consultar'),('orcamentista','obras.consultar'),('consulta','obras.consultar')
ON CONFLICT DO NOTHING;

UPDATE app.module_catalog_versions SET status='substituida' WHERE status='publicada';
INSERT INTO app.module_catalog_versions (versao,status,descricao,criado_por)
VALUES (7,'publicada','Catálogo modular PRUMO 16.0','migracao-023');
INSERT INTO app.module_capabilities (module_id,capability_id,nome,versao_catalogo,status) VALUES
  ('obras','carteira-obras','Carteira corporativa ligada a patrimônio, orçamento e contrato',7,'ativa'),
  ('obras','cronograma-diario','Cronograma físico-financeiro, diário e evidências',7,'ativa'),
  ('medicoes','boletins-corporativos','Boletins, itens, retenções, glosas, aceite e saldo',7,'ativa')
ON CONFLICT DO NOTHING;
INSERT INTO app.module_dependencies (module_id,depends_on_module_id,obrigatoria) VALUES
  ('obras','patrimonio',true),('obras','contratos',false),('obras','orcamentos',false),('obras','documentos',false),
  ('medicoes','obras',true),('medicoes','contratos',false),('medicoes','financeiro',false),('medicoes','documentos',false)
ON CONFLICT (module_id,depends_on_module_id) DO UPDATE SET obrigatoria=EXCLUDED.obrigatoria;

ALTER TABLE app.empreendimentos
  ADD COLUMN contrato_id uuid,
  ADD COLUMN orcamento_id uuid,
  ADD COLUMN responsavel text NOT NULL DEFAULT '',
  ADD COLUMN data_inicio date,
  ADD COLUMN data_fim_prevista date,
  ADD COLUMN valor_previsto numeric(18,2) NOT NULL DEFAULT 0 CHECK (valor_previsto >= 0),
  ADD COLUMN progresso_fisico numeric(7,2) NOT NULL DEFAULT 0 CHECK (progresso_fisico BETWEEN 0 AND 100),
  ADD COLUMN atualizado_por text NOT NULL DEFAULT 'migracao-023';

ALTER TABLE app.empreendimentos
  ADD CONSTRAINT empreendimentos_contrato_fk FOREIGN KEY (tenant_id,contrato_id,team_id) REFERENCES app.contracts(tenant_id,id,team_id),
  ADD CONSTRAINT empreendimentos_orcamento_fk FOREIGN KEY (tenant_id,orcamento_id) REFERENCES app.orcamentos(tenant_id,id),
  ADD CONSTRAINT empreendimentos_periodo_check CHECK (data_fim_prevista IS NULL OR data_inicio IS NULL OR data_fim_prevista >= data_inicio);
CREATE UNIQUE INDEX empreendimentos_codigo_corporativo_uq ON app.empreendimentos(tenant_id,team_id,upper(codigo)) WHERE btrim(codigo)<>'';
CREATE INDEX empreendimentos_execucao_idx ON app.empreendimentos(tenant_id,team_id,status,data_fim_prevista);

CREATE TABLE app.work_schedule_items (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, work_id uuid NOT NULL,
  codigo text NOT NULL, titulo text NOT NULL, data_inicio date NOT NULL, data_fim date NOT NULL,
  peso numeric(7,2) NOT NULL DEFAULT 0 CHECK (peso BETWEEN 0 AND 100),
  progresso numeric(7,2) NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  valor_previsto numeric(18,2) NOT NULL DEFAULT 0 CHECK (valor_previsto >= 0),
  status text NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado','em_andamento','concluido','atrasado','cancelado')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, versao bigint NOT NULL DEFAULT 1 CHECK (versao>0),
  criado_por text NOT NULL, atualizado_por text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id), UNIQUE (tenant_id,work_id,codigo),
  FOREIGN KEY (tenant_id,work_id) REFERENCES app.empreendimentos(tenant_id,id),
  FOREIGN KEY (tenant_id,team_id) REFERENCES app.teams(tenant_id,id), CHECK (btrim(codigo)<>'' AND btrim(titulo)<>'' AND data_fim>=data_inicio)
);

CREATE TABLE app.work_diary_entries (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, work_id uuid NOT NULL,
  data_registro date NOT NULL, clima text NOT NULL DEFAULT '', efetivo integer NOT NULL DEFAULT 0 CHECK (efetivo>=0),
  atividades text NOT NULL, ocorrencias text NOT NULL DEFAULT '', evidencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  registrado_por text NOT NULL, registrado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,team_id),
  FOREIGN KEY (tenant_id,work_id) REFERENCES app.empreendimentos(tenant_id,id),
  FOREIGN KEY (tenant_id,team_id) REFERENCES app.teams(tenant_id,id), CHECK (btrim(atividades)<>'')
);

ALTER TABLE app.medicoes ALTER COLUMN orcamento_id DROP NOT NULL;
ALTER TABLE app.medicoes
  ADD COLUMN obra_id uuid,
  ADD COLUMN contrato_id uuid,
  ADD COLUMN glosas numeric(18,2) NOT NULL DEFAULT 0 CHECK (glosas>=0),
  ADD COLUMN valor_atestado numeric(18,2) GENERATED ALWAYS AS (valor_bruto-retencoes-multas-glosas) STORED,
  ADD COLUMN enviado_em timestamptz,
  ADD COLUMN aprovado_por text,
  ADD COLUMN aceite_em timestamptz,
  ADD COLUMN atualizado_por text NOT NULL DEFAULT 'migracao-023';
ALTER TABLE app.medicoes
  ADD CONSTRAINT medicoes_origem_check CHECK (orcamento_id IS NOT NULL OR obra_id IS NOT NULL),
  ADD CONSTRAINT medicoes_deducoes_corporativas_check CHECK (retencoes+multas+glosas<=valor_bruto),
  ADD CONSTRAINT medicoes_obra_fk FOREIGN KEY (tenant_id,obra_id) REFERENCES app.empreendimentos(tenant_id,id),
  ADD CONSTRAINT medicoes_contrato_fk FOREIGN KEY (tenant_id,contrato_id,team_id) REFERENCES app.contracts(tenant_id,id,team_id);
CREATE UNIQUE INDEX medicoes_obra_numero_uq ON app.medicoes(tenant_id,obra_id,numero) WHERE obra_id IS NOT NULL;
CREATE INDEX medicoes_obra_status_idx ON app.medicoes(tenant_id,team_id,obra_id,status,periodo_fim DESC);

CREATE TABLE app.measurement_items (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, measurement_id uuid NOT NULL,
  codigo text NOT NULL, descricao text NOT NULL, unidade text NOT NULL DEFAULT '',
  quantidade_prevista numeric(18,4) NOT NULL DEFAULT 0 CHECK (quantidade_prevista>=0),
  quantidade_periodo numeric(18,4) NOT NULL DEFAULT 0 CHECK (quantidade_periodo>=0),
  quantidade_acumulada numeric(18,4) NOT NULL DEFAULT 0 CHECK (quantidade_acumulada>=0),
  valor_unitario numeric(18,4) NOT NULL DEFAULT 0 CHECK (valor_unitario>=0),
  valor_periodo numeric(18,2) GENERATED ALWAYS AS (trunc(quantidade_periodo*valor_unitario,2)) STORED,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb, criado_por text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,measurement_id,codigo),
  FOREIGN KEY (tenant_id,measurement_id) REFERENCES app.medicoes(tenant_id,id),
  FOREIGN KEY (tenant_id,team_id) REFERENCES app.teams(tenant_id,id),
  CHECK (btrim(codigo)<>'' AND btrim(descricao)<>'' AND quantidade_acumulada<=quantidade_prevista)
);

CREATE TABLE app.measurement_decisions (
  tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, measurement_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('enviar','aprovar','glosar','devolver','aceitar','cancelar')),
  status_anterior text NOT NULL, status_novo text NOT NULL, justificativa text NOT NULL DEFAULT '',
  decidido_por text NOT NULL, decidido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,measurement_id) REFERENCES app.medicoes(tenant_id,id),
  FOREIGN KEY (tenant_id,team_id) REFERENCES app.teams(tenant_id,id)
);

CREATE OR REPLACE FUNCTION app.bloquear_historico_obras() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'histórico de fiscalização é imutável' USING ERRCODE='55000'; END; $$;
CREATE TRIGGER work_diary_immutable BEFORE UPDATE OR DELETE ON app.work_diary_entries FOR EACH ROW EXECUTE FUNCTION app.bloquear_historico_obras();
CREATE TRIGGER measurement_decisions_immutable BEFORE UPDATE OR DELETE ON app.measurement_decisions FOR EACH ROW EXECUTE FUNCTION app.bloquear_historico_obras();

ALTER TABLE app.work_schedule_items ENABLE ROW LEVEL SECURITY; ALTER TABLE app.work_schedule_items FORCE ROW LEVEL SECURITY;
ALTER TABLE app.work_diary_entries ENABLE ROW LEVEL SECURITY; ALTER TABLE app.work_diary_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE app.measurement_items ENABLE ROW LEVEL SECURITY; ALTER TABLE app.measurement_items FORCE ROW LEVEL SECURITY;
ALTER TABLE app.measurement_decisions ENABLE ROW LEVEL SECURITY; ALTER TABLE app.measurement_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY work_schedule_isolation ON app.work_schedule_items FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY work_diary_isolation ON app.work_diary_entries FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY measurement_items_isolation ON app.measurement_items FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);
CREATE POLICY measurement_decisions_isolation ON app.measurement_decisions FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND team_id=nullif(current_setting('app.team_id',true),'')::uuid);

GRANT SELECT,INSERT,UPDATE ON app.empreendimentos,app.work_schedule_items,app.medicoes TO prumo_api;
GRANT SELECT,INSERT ON app.work_diary_entries,app.measurement_items,app.measurement_decisions TO prumo_api;
