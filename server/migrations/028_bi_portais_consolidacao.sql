INSERT INTO app.permissions(id,module_id,descricao) VALUES
 ('relatorios.configurar','relatorios','Configurar painéis e relatórios'),('portais.consultar','relatorios','Consultar acessos de portais'),
 ('portais.administrar','relatorios','Administrar acessos externos'),('observabilidade.consultar','administracao','Consultar saúde operacional')
ON CONFLICT(id) DO UPDATE SET module_id=EXCLUDED.module_id,descricao=EXCLUDED.descricao;
INSERT INTO app.default_profile_permissions(perfil_id,permission_id) SELECT 'administrador',id FROM app.permissions WHERE id IN('relatorios.configurar','portais.consultar','portais.administrar','observabilidade.consultar') ON CONFLICT DO NOTHING;
INSERT INTO app.default_profile_permissions(perfil_id,permission_id) VALUES('gestor','relatorios.configurar'),('gestor','portais.consultar'),('gestor','portais.administrar'),('aprovador','portais.consultar') ON CONFLICT DO NOTHING;
UPDATE app.module_catalog_versions SET status='substituida' WHERE status='publicada';
INSERT INTO app.module_catalog_versions(versao,status,descricao,criado_por) VALUES(11,'publicada','Catálogo modular PRUMO 20.0','migracao-028');
INSERT INTO app.module_capabilities(module_id,capability_id,nome,versao_catalogo,status) VALUES
 ('relatorios','bi-executivo','Indicadores executivos consolidados e autorizados',11,'ativa'),('relatorios','relatorios-configuraveis','Definições de relatórios e filtros salvos',11,'ativa'),
 ('relatorios','portais-externos','Portais segregados para clientes, fornecedores e fiscalização',11,'ativa'),('administracao','observabilidade-operacional','Saúde, integrações e prontidão operacional',11,'ativa') ON CONFLICT DO NOTHING;

CREATE TABLE app.report_definitions(
 tenant_id uuid NOT NULL REFERENCES app.tenants(id),id uuid NOT NULL,team_id uuid NOT NULL,codigo text NOT NULL,nome text NOT NULL,descricao text NOT NULL DEFAULT '',
 modulos text[] NOT NULL DEFAULT '{}',configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,compartilhado boolean NOT NULL DEFAULT false,status text NOT NULL DEFAULT 'ativo' CHECK(status IN('ativo','inativo')),
 versao bigint NOT NULL DEFAULT 1,criado_por text NOT NULL,atualizado_por text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,id,team_id),UNIQUE(tenant_id,team_id,codigo),FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id)
);
CREATE TABLE app.portal_accesses(
 tenant_id uuid NOT NULL,id uuid NOT NULL,team_id uuid NOT NULL,tipo text NOT NULL CHECK(tipo IN('cliente','fornecedor','fiscalizacao')),nome text NOT NULL,email text NOT NULL,
 escopo jsonb NOT NULL DEFAULT '{}'::jsonb,token_hash text NOT NULL,token_prefixo text NOT NULL,expira_em timestamptz NOT NULL,status text NOT NULL DEFAULT 'ativo' CHECK(status IN('ativo','revogado','expirado')),
 ultimo_acesso_em timestamptz,versao bigint NOT NULL DEFAULT 1,criado_por text NOT NULL,atualizado_por text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,id,team_id),UNIQUE(tenant_id,token_hash),FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id)
);
CREATE TABLE app.integration_channels(
 tenant_id uuid NOT NULL,id uuid NOT NULL,team_id uuid NOT NULL,codigo text NOT NULL,nome text NOT NULL,tipo text NOT NULL CHECK(tipo IN('contabil','bancaria','oficial','webhook','arquivo')),
 direcao text NOT NULL DEFAULT 'bidirecional' CHECK(direcao IN('entrada','saida','bidirecional')),configuracao_publica jsonb NOT NULL DEFAULT '{}'::jsonb,segredo_referencia text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'configuracao' CHECK(status IN('configuracao','ativo','pausado','erro')),ultima_execucao_em timestamptz,ultimo_status text NOT NULL DEFAULT '',versao bigint NOT NULL DEFAULT 1,
 criado_por text NOT NULL,atualizado_por text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),atualizado_em timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,id,team_id),UNIQUE(tenant_id,team_id,codigo),FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id)
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['report_definitions','portal_accesses','integration_channels'] LOOP EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY %I ON app.%I FOR ALL USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND team_id=nullif(current_setting(''app.team_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND team_id=nullif(current_setting(''app.team_id'',true),'''')::uuid)',t||'_isolation',t);END LOOP;END $$;
GRANT SELECT,INSERT,UPDATE ON app.report_definitions,app.portal_accesses,app.integration_channels TO prumo_api;
