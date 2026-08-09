INSERT INTO app.permissions (id, module_id, descricao) VALUES
  ('produto-modular.consultar', 'administracao', 'Consultar produto e capacidades contratadas'),
  ('produto-modular.administrar', 'administracao', 'Administrar perfil e módulos contratados')
ON CONFLICT (id) DO UPDATE SET module_id = EXCLUDED.module_id, descricao = EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id)
SELECT 'administrador', id FROM app.permissions
WHERE id IN ('produto-modular.consultar', 'produto-modular.administrar')
ON CONFLICT DO NOTHING;
INSERT INTO app.default_profile_permissions (perfil_id, permission_id) VALUES
  ('gestor', 'produto-modular.consultar')
ON CONFLICT DO NOTHING;

CREATE TABLE app.module_catalog_versions (
  versao integer PRIMARY KEY CHECK (versao > 0),
  status text NOT NULL CHECK (status IN ('rascunho', 'publicada', 'substituida')),
  descricao text NOT NULL DEFAULT '',
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.module_capabilities (
  module_id text NOT NULL REFERENCES app.modules(id),
  capability_id text NOT NULL,
  nome text NOT NULL,
  versao_catalogo integer NOT NULL REFERENCES app.module_catalog_versions(versao),
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa')),
  PRIMARY KEY (module_id, capability_id, versao_catalogo)
);

CREATE TABLE app.module_dependencies (
  module_id text NOT NULL REFERENCES app.modules(id),
  depends_on_module_id text NOT NULL REFERENCES app.modules(id),
  obrigatoria boolean NOT NULL DEFAULT true,
  PRIMARY KEY (module_id, depends_on_module_id),
  CHECK (module_id <> depends_on_module_id)
);

CREATE TABLE app.tenant_product_profiles (
  tenant_id uuid PRIMARY KEY REFERENCES app.tenants(id),
  perfil text NOT NULL DEFAULT 'publico' CHECK (perfil IN ('publico', 'federacao', 'privado', 'escritorio', 'facilities')),
  terminologia jsonb NOT NULL DEFAULT '{}'::jsonb,
  templates jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_por text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.tenant_module_contracts (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  module_id text NOT NULL REFERENCES app.modules(id),
  disponivel boolean NOT NULL DEFAULT true,
  contratado boolean NOT NULL DEFAULT true,
  habilitado boolean NOT NULL DEFAULT true,
  pacote text NOT NULL DEFAULT 'plataforma',
  limites jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_por text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module_id),
  CHECK (NOT habilitado OR (disponivel AND contratado))
);

INSERT INTO app.module_catalog_versions (versao, status, descricao, criado_por)
VALUES (1, 'publicada', 'Catálogo modular PRUMO 10.6', 'migracao-009');

INSERT INTO app.module_capabilities (module_id, capability_id, nome, versao_catalogo) VALUES
  ('obras', 'hierarquia-cliente-site-predio-sala', 'Hierarquia patrimonial Cliente · Site · Prédio · Sala', 1),
  ('orcamentos', 'orcamento-obras-publicas', 'Orçamentos e composições para obras públicas', 1),
  ('documentos', 'ged-versionado', 'GED com versões, hash e vínculos técnicos', 1),
  ('administracao', 'governanca-auditavel', 'Governança, auditoria e produto modular', 1)
ON CONFLICT DO NOTHING;

INSERT INTO app.module_dependencies (module_id, depends_on_module_id) VALUES
  ('bases-precos', 'orcamentos'),
  ('suprimentos', 'orcamentos'),
  ('medicoes', 'obras'),
  ('documentos', 'visao-geral'),
  ('relatorios', 'visao-geral'),
  ('administracao', 'visao-geral')
ON CONFLICT DO NOTHING;

INSERT INTO app.tenant_product_profiles (tenant_id, perfil, atualizado_por)
SELECT id, 'publico', 'migracao-009' FROM app.tenants ON CONFLICT DO NOTHING;

INSERT INTO app.tenant_module_contracts (tenant_id, module_id, atualizado_por)
SELECT t.id, m.id, 'migracao-009' FROM app.tenants t CROSS JOIN app.modules m
ON CONFLICT DO NOTHING;

ALTER TABLE app.tenant_product_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tenant_product_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE app.tenant_module_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tenant_module_contracts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_product_profiles_isolamento ON app.tenant_product_profiles FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY tenant_module_contracts_isolamento ON app.tenant_module_contracts FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT ON app.module_catalog_versions, app.module_capabilities, app.module_dependencies TO prumo_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.tenant_product_profiles, app.tenant_module_contracts TO prumo_api;

