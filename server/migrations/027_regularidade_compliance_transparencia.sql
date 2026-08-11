INSERT INTO app.modules(id,nome,ordem,status) VALUES('regularidade','Regularidade e Compliance',82,'ativo')
ON CONFLICT(id) DO UPDATE SET nome=EXCLUDED.nome,ordem=EXCLUDED.ordem,status='ativo';
INSERT INTO app.permissions(id,module_id,descricao) VALUES
 ('regularidade.consultar','regularidade','Consultar regularidade, riscos e transparência'),('regularidade.editar','regularidade','Gerir requisitos e planos de ação'),
 ('regularidade.auditar','regularidade','Registrar auditorias e evidências'),('transparencia.publicar','regularidade','Autorizar publicações de transparência')
ON CONFLICT(id) DO UPDATE SET module_id=EXCLUDED.module_id,descricao=EXCLUDED.descricao;
INSERT INTO app.default_profile_permissions(perfil_id,permission_id) SELECT 'administrador',id FROM app.permissions WHERE module_id='regularidade' ON CONFLICT DO NOTHING;
INSERT INTO app.default_profile_permissions(perfil_id,permission_id) VALUES
 ('gestor','regularidade.consultar'),('gestor','regularidade.editar'),('gestor','regularidade.auditar'),('fiscal','regularidade.consultar'),('fiscal','regularidade.auditar'),
 ('aprovador','regularidade.consultar'),('aprovador','transparencia.publicar'),('consulta','regularidade.consultar') ON CONFLICT DO NOTHING;
UPDATE app.module_catalog_versions SET status='substituida' WHERE status='publicada';
INSERT INTO app.module_catalog_versions(versao,status,descricao,criado_por) VALUES(10,'publicada','Catálogo modular PRUMO 19.0','migracao-027');
INSERT INTO app.module_capabilities(module_id,capability_id,nome,versao_catalogo,status) VALUES
 ('regularidade','requisitos-vencimentos','Licenças, PPCI, ART/RRT e vencimentos',10,'ativa'),('regularidade','riscos-controles','Matriz de riscos, controles e planos de ação',10,'ativa'),
 ('regularidade','auditoria-transparencia','Auditorias, evidências e transparência autorizada',10,'ativa') ON CONFLICT DO NOTHING;
INSERT INTO app.module_dependencies(module_id,depends_on_module_id,obrigatoria) VALUES
 ('regularidade','patrimonio',true),('regularidade','documentos',false),('regularidade','ppci',false),('regularidade','relatorios',false)
ON CONFLICT(module_id,depends_on_module_id) DO UPDATE SET obrigatoria=EXCLUDED.obrigatoria;

CREATE TABLE app.compliance_requirements(
 tenant_id uuid NOT NULL REFERENCES app.tenants(id),id uuid NOT NULL,team_id uuid NOT NULL,patrimonio_unidade_id uuid NOT NULL,codigo text NOT NULL,tipo text NOT NULL,
 titulo text NOT NULL,orgao_emissor text NOT NULL DEFAULT '',numero_documento text NOT NULL DEFAULT '',data_emissao date,data_validade date,responsavel text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pendente' CHECK(status IN('pendente','regular','a_vencer','vencido','dispensado','cancelado')),criticidade text NOT NULL DEFAULT 'media' CHECK(criticidade IN('baixa','media','alta','critica')),
 documento_id uuid,dados jsonb NOT NULL DEFAULT '{}'::jsonb,versao bigint NOT NULL DEFAULT 1,criado_por text NOT NULL,atualizado_por text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,id,team_id),UNIQUE(tenant_id,team_id,codigo),FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id),FOREIGN KEY(tenant_id,patrimonio_unidade_id) REFERENCES app.patrimonial_units(tenant_id,id)
);
CREATE TABLE app.compliance_risks(
 tenant_id uuid NOT NULL,id uuid NOT NULL,team_id uuid NOT NULL,requirement_id uuid,codigo text NOT NULL,titulo text NOT NULL,descricao text NOT NULL,
 probabilidade integer NOT NULL CHECK(probabilidade BETWEEN 1 AND 5),impacto integer NOT NULL CHECK(impacto BETWEEN 1 AND 5),nivel integer GENERATED ALWAYS AS(probabilidade*impacto) STORED,
 controle text NOT NULL DEFAULT '',responsavel text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'aberto' CHECK(status IN('aberto','mitigando','aceito','encerrado')),dados jsonb NOT NULL DEFAULT '{}'::jsonb,
 versao bigint NOT NULL DEFAULT 1,criado_por text NOT NULL,atualizado_por text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,id,team_id),UNIQUE(tenant_id,team_id,codigo),
 FOREIGN KEY(tenant_id,requirement_id,team_id) REFERENCES app.compliance_requirements(tenant_id,id,team_id)
);
CREATE TABLE app.compliance_actions(
 tenant_id uuid NOT NULL,id uuid NOT NULL,team_id uuid NOT NULL,risk_id uuid NOT NULL,titulo text NOT NULL,descricao text NOT NULL,responsavel text NOT NULL,prazo date NOT NULL,
 percentual numeric(5,2) NOT NULL DEFAULT 0 CHECK(percentual BETWEEN 0 AND 100),status text NOT NULL DEFAULT 'aberta' CHECK(status IN('aberta','em_andamento','concluida','cancelada')),evidencia_documento_id uuid,dados jsonb NOT NULL DEFAULT '{}'::jsonb,
 versao bigint NOT NULL DEFAULT 1,criado_por text NOT NULL,atualizado_por text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,id,team_id),FOREIGN KEY(tenant_id,risk_id,team_id) REFERENCES app.compliance_risks(tenant_id,id,team_id)
);
CREATE TABLE app.compliance_audits(
 tenant_id uuid NOT NULL,id uuid NOT NULL,team_id uuid NOT NULL,codigo text NOT NULL,titulo text NOT NULL,escopo text NOT NULL,data_auditoria date NOT NULL,auditor text NOT NULL,
 conclusao text NOT NULL,classificacao text NOT NULL DEFAULT 'conforme' CHECK(classificacao IN('conforme','ressalva','nao_conforme')),evidencias jsonb NOT NULL DEFAULT '[]'::jsonb,dados jsonb NOT NULL DEFAULT '{}'::jsonb,
 registrado_por text NOT NULL,registrado_em timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,team_id,codigo),FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id)
);
CREATE TABLE app.transparency_publications(
 tenant_id uuid NOT NULL,id uuid NOT NULL,team_id uuid NOT NULL,codigo text NOT NULL,titulo text NOT NULL,categoria text NOT NULL,descricao_publica text NOT NULL,
 periodo_referencia text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'rascunho' CHECK(status IN('rascunho','publicada','suspensa','arquivada')),publicado_em timestamptz,
 conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,dados_internos jsonb NOT NULL DEFAULT '{}'::jsonb,versao bigint NOT NULL DEFAULT 1,criado_por text NOT NULL,atualizado_por text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,id,team_id),UNIQUE(tenant_id,team_id,codigo),FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id)
);
CREATE INDEX compliance_due_idx ON app.compliance_requirements(tenant_id,team_id,status,data_validade);CREATE INDEX compliance_risk_idx ON app.compliance_risks(tenant_id,team_id,status,nivel DESC);CREATE INDEX compliance_action_due_idx ON app.compliance_actions(tenant_id,team_id,status,prazo);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['compliance_requirements','compliance_risks','compliance_actions','compliance_audits','transparency_publications'] LOOP EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY %I ON app.%I FOR ALL USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND team_id=nullif(current_setting(''app.team_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND team_id=nullif(current_setting(''app.team_id'',true),'''')::uuid)',t||'_isolation',t);END LOOP;END $$;
GRANT SELECT,INSERT,UPDATE ON app.compliance_requirements,app.compliance_risks,app.compliance_actions,app.transparency_publications TO prumo_api;
GRANT SELECT,INSERT ON app.compliance_audits TO prumo_api;
