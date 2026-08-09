INSERT INTO app.permissions (id, module_id, descricao) VALUES
  ('documentos.aprovar', 'documentos', 'Aprovar e publicar documentos'),
  ('integracoes.consultar', 'administracao', 'Consultar integrações corporativas'),
  ('integracoes.administrar', 'administracao', 'Administrar integrações corporativas')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, descricao = EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id)
SELECT 'administrador', id FROM app.permissions
WHERE id IN ('documentos.aprovar', 'integracoes.consultar', 'integracoes.administrar')
ON CONFLICT DO NOTHING;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id) VALUES
  ('gestor', 'documentos.aprovar'),
  ('gestor', 'integracoes.consultar'),
  ('aprovador', 'documentos.aprovar')
ON CONFLICT DO NOTHING;

CREATE TABLE app.documents (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid,
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'documento_tecnico',
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_revisao', 'aprovado', 'arquivado')),
  versao_atual integer NOT NULL DEFAULT 0 CHECK (versao_atual >= 0),
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id)
);

CREATE TABLE app.document_versions (
  tenant_id uuid NOT NULL,
  document_id uuid NOT NULL,
  numero integer NOT NULL CHECK (numero > 0),
  nome_arquivo text NOT NULL,
  tipo_mime text NOT NULL DEFAULT 'application/octet-stream',
  tamanho_bytes bigint NOT NULL DEFAULT 0 CHECK (tamanho_bytes >= 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  storage_key text NOT NULL,
  responsavel text NOT NULL,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, document_id, numero),
  FOREIGN KEY (tenant_id, document_id) REFERENCES app.documents(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE app.document_links (
  tenant_id uuid NOT NULL,
  document_id uuid NOT NULL,
  module_id text NOT NULL REFERENCES app.modules(id),
  entidade_tipo text NOT NULL,
  entidade_id text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, document_id, module_id, entidade_tipo, entidade_id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES app.documents(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE app.integrations (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  nome text NOT NULL,
  provedor text NOT NULL,
  status text NOT NULL DEFAULT 'inativa' CHECK (status IN ('ativa', 'inativa', 'suspensa')),
  credential_reference text NOT NULL DEFAULT '',
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE app.integration_runs (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  integration_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('iniciada', 'concluida', 'falhou')),
  direcao text NOT NULL DEFAULT 'entrada' CHECK (direcao IN ('entrada', 'saida', 'bidirecional')),
  contagens jsonb NOT NULL DEFAULT '{}'::jsonb,
  erro_sanitizado text NOT NULL DEFAULT '',
  executado_por text NOT NULL,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, integration_id) REFERENCES app.integrations(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX documents_tenant_updated_idx ON app.documents (tenant_id, atualizado_em DESC);
CREATE INDEX integration_runs_tenant_started_idx ON app.integration_runs (tenant_id, iniciado_em DESC);

ALTER TABLE app.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.documents FORCE ROW LEVEL SECURITY;
ALTER TABLE app.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.document_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.document_links FORCE ROW LEVEL SECURITY;
ALTER TABLE app.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.integrations FORCE ROW LEVEL SECURITY;
ALTER TABLE app.integration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.integration_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY documents_isolamento ON app.documents FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid));
CREATE POLICY document_versions_isolamento ON app.document_versions FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY document_links_isolamento ON app.document_links FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY integrations_isolamento ON app.integrations FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY integration_runs_isolamento ON app.integration_runs FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON app.documents, app.document_versions, app.document_links,
  app.integrations, app.integration_runs TO prumo_api;

