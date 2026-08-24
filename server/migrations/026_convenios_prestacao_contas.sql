INSERT INTO app.modules (id,nome,ordem,status) VALUES ('convenios','Convênios e Repasses',105,'ativo')
ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome,ordem=EXCLUDED.ordem,status='ativo';

INSERT INTO app.permissions (id,module_id,descricao) VALUES
 ('convenios.consultar','convenios','Consultar convênios e prestações de contas'),
 ('convenios.editar','convenios','Cadastrar instrumentos, metas e repasses'),
 ('convenios.executar','convenios','Registrar execução físico-financeira'),
 ('convenios.prestar-contas','convenios','Submeter e decidir prestações de contas')
ON CONFLICT (id) DO UPDATE SET module_id=EXCLUDED.module_id,descricao=EXCLUDED.descricao;
INSERT INTO app.default_profile_permissions (perfil_id,permission_id)
SELECT 'administrador',id FROM app.permissions WHERE id LIKE 'convenios.%' ON CONFLICT DO NOTHING;
INSERT INTO app.default_profile_permissions (perfil_id,permission_id) VALUES
 ('gestor','convenios.consultar'),('gestor','convenios.editar'),('gestor','convenios.executar'),('gestor','convenios.prestar-contas'),
 ('fiscal','convenios.consultar'),('fiscal','convenios.executar'),('aprovador','convenios.consultar'),('aprovador','convenios.prestar-contas'),
 ('consulta','convenios.consultar') ON CONFLICT DO NOTHING;

UPDATE app.module_catalog_versions SET status='substituida' WHERE status='publicada';
INSERT INTO app.module_catalog_versions (versao,status,descricao,criado_por) VALUES (9,'publicada','Catálogo modular PRUMO 18.0','migracao-026');
INSERT INTO app.module_capabilities (module_id,capability_id,nome,versao_catalogo,status) VALUES
 ('convenios','instrumentos-metas','Instrumentos, partícipes, metas e etapas',9,'ativa'),
 ('convenios','repasses-execucao','Repasses, contrapartidas e execução físico-financeira',9,'ativa'),
 ('convenios','prestacao-contas','Evidências, diligências e prestação de contas',9,'ativa') ON CONFLICT DO NOTHING;
INSERT INTO app.module_dependencies (module_id,depends_on_module_id,obrigatoria) VALUES
 ('convenios','planejamento',false),('convenios','financeiro',false),('convenios','contratos',false),('convenios','documentos',false)
ON CONFLICT (module_id,depends_on_module_id) DO UPDATE SET obrigatoria=EXCLUDED.obrigatoria;

CREATE TABLE app.agreements (
 tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
 codigo text NOT NULL, numero text NOT NULL DEFAULT '', titulo text NOT NULL, programa text NOT NULL DEFAULT '',
 concedente text NOT NULL, convenente text NOT NULL, objeto text NOT NULL, data_inicio date NOT NULL, data_fim date NOT NULL,
 valor_repasse numeric(18,2) NOT NULL DEFAULT 0 CHECK(valor_repasse>=0), valor_contrapartida numeric(18,2) NOT NULL DEFAULT 0 CHECK(valor_contrapartida>=0),
 status text NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho','vigente','em_execucao','prestacao_contas','encerrado','cancelado')),
 dados jsonb NOT NULL DEFAULT '{}'::jsonb, versao bigint NOT NULL DEFAULT 1 CHECK(versao>0),
 criado_por text NOT NULL, atualizado_por text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,id,team_id), UNIQUE(tenant_id,team_id,codigo), FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id),
 CHECK(data_fim>=data_inicio AND btrim(codigo)<>'' AND btrim(titulo)<>'' AND btrim(objeto)<>'')
);
CREATE TABLE app.agreement_goals (
 tenant_id uuid NOT NULL,id uuid NOT NULL,team_id uuid NOT NULL,agreement_id uuid NOT NULL,codigo text NOT NULL,descricao text NOT NULL,
 unidade text NOT NULL DEFAULT '',quantidade_prevista numeric(18,4) NOT NULL DEFAULT 0 CHECK(quantidade_prevista>=0),valor_previsto numeric(18,2) NOT NULL DEFAULT 0 CHECK(valor_previsto>=0),
 inicio_previsto date,fim_previsto date,status text NOT NULL DEFAULT 'planejada' CHECK(status IN ('planejada','em_execucao','concluida','cancelada')),dados jsonb NOT NULL DEFAULT '{}'::jsonb,
 criado_por text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,agreement_id,codigo),
 FOREIGN KEY(tenant_id,agreement_id,team_id) REFERENCES app.agreements(tenant_id,id,team_id)
);
CREATE TABLE app.agreement_transfers (
 tenant_id uuid NOT NULL,id uuid NOT NULL,team_id uuid NOT NULL,agreement_id uuid NOT NULL,tipo text NOT NULL CHECK(tipo IN ('repasse','contrapartida','rendimento','devolucao')),
 parcela text NOT NULL DEFAULT '',data_prevista date,data_realizada date,valor numeric(18,2) NOT NULL CHECK(valor>0),status text NOT NULL DEFAULT 'previsto' CHECK(status IN ('previsto','recebido','devolvido','cancelado')),
 referencia text NOT NULL DEFAULT '',dados jsonb NOT NULL DEFAULT '{}'::jsonb,registrado_por text NOT NULL,registrado_em timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,agreement_id,team_id) REFERENCES app.agreements(tenant_id,id,team_id)
);
CREATE TABLE app.agreement_executions (
 tenant_id uuid NOT NULL,id uuid NOT NULL,team_id uuid NOT NULL,agreement_id uuid NOT NULL,goal_id uuid,data_execucao date NOT NULL,
 descricao text NOT NULL,quantidade_executada numeric(18,4) NOT NULL DEFAULT 0 CHECK(quantidade_executada>=0),valor_executado numeric(18,2) NOT NULL DEFAULT 0 CHECK(valor_executado>=0),
 evidencia_documento_id uuid,referencia text NOT NULL DEFAULT '',dados jsonb NOT NULL DEFAULT '{}'::jsonb,registrado_por text NOT NULL,registrado_em timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,agreement_id,team_id) REFERENCES app.agreements(tenant_id,id,team_id),FOREIGN KEY(tenant_id,goal_id) REFERENCES app.agreement_goals(tenant_id,id)
);
CREATE TABLE app.agreement_accountabilities (
 tenant_id uuid NOT NULL,id uuid NOT NULL,team_id uuid NOT NULL,agreement_id uuid NOT NULL,tipo text NOT NULL DEFAULT 'final' CHECK(tipo IN ('parcial','final')),
 periodo_inicio date NOT NULL,periodo_fim date NOT NULL,valor_informado numeric(18,2) NOT NULL DEFAULT 0 CHECK(valor_informado>=0),
 status text NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho','submetida','em_analise','aprovada','rejeitada')),protocolo text NOT NULL DEFAULT '',parecer text NOT NULL DEFAULT '',dados jsonb NOT NULL DEFAULT '{}'::jsonb,
 versao bigint NOT NULL DEFAULT 1,criado_por text NOT NULL,atualizado_por text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,id,team_id),FOREIGN KEY(tenant_id,agreement_id,team_id) REFERENCES app.agreements(tenant_id,id,team_id),CHECK(periodo_fim>=periodo_inicio)
);
CREATE TABLE app.agreement_diligences (
 tenant_id uuid NOT NULL,id uuid NOT NULL,team_id uuid NOT NULL,agreement_id uuid NOT NULL,accountability_id uuid,titulo text NOT NULL,descricao text NOT NULL,
 prazo date NOT NULL,status text NOT NULL DEFAULT 'aberta' CHECK(status IN ('aberta','respondida','aceita','vencida','cancelada')),resposta text NOT NULL DEFAULT '',dados jsonb NOT NULL DEFAULT '{}'::jsonb,
 criado_por text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),respondido_por text,respondido_em timestamptz,PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,agreement_id,team_id) REFERENCES app.agreements(tenant_id,id,team_id),FOREIGN KEY(tenant_id,accountability_id,team_id) REFERENCES app.agreement_accountabilities(tenant_id,id,team_id)
);

CREATE INDEX agreements_status_idx ON app.agreements(tenant_id,team_id,status,data_fim);
CREATE INDEX agreement_diligences_deadline_idx ON app.agreement_diligences(tenant_id,team_id,status,prazo);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['agreements','agreement_goals','agreement_transfers','agreement_executions','agreement_accountabilities','agreement_diligences'] LOOP
 EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY %I ON app.%I FOR ALL USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND team_id=nullif(current_setting(''app.team_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND team_id=nullif(current_setting(''app.team_id'',true),'''')::uuid)',t||'_isolation',t);
 END LOOP; END $$;
GRANT SELECT,INSERT,UPDATE ON app.agreements,app.agreement_goals,app.agreement_accountabilities,app.agreement_diligences TO prumo_api;
GRANT SELECT,INSERT ON app.agreement_transfers,app.agreement_executions TO prumo_api;
