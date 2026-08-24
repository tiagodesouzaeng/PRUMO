CREATE TABLE IF NOT EXISTS app.catalog_sources (
  id text PRIMARY KEY,
  tenant_id uuid REFERENCES app.tenants(id),
  codigo text NOT NULL,
  nome text NOT NULL,
  gestor text NOT NULL DEFAULT '',
  escopo text NOT NULL DEFAULT 'privada'
    CHECK (escopo IN ('global', 'licenciada', 'privada')),
  status text NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('ativa', 'inativa', 'arquivada')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (escopo = 'global' AND tenant_id IS NULL)
    OR (escopo <> 'global' AND tenant_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_sources_tenant_codigo_idx
  ON app.catalog_sources (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo);

CREATE TABLE IF NOT EXISTS app.catalog_publications (
  id uuid PRIMARY KEY,
  source_id text NOT NULL REFERENCES app.catalog_sources(id),
  tenant_id uuid REFERENCES app.tenants(id),
  referencia text NOT NULL,
  regime text NOT NULL DEFAULT 'PADRAO',
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'validando', 'homologada', 'rejeitada', 'arquivada')),
  hash_fonte text NOT NULL DEFAULT '',
  arquivo_nome text NOT NULL DEFAULT '',
  contagens jsonb NOT NULL DEFAULT '{}'::jsonb,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  homologada_por text,
  homologada_em timestamptz,
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, source_id, referencia, regime)
);

CREATE INDEX IF NOT EXISTS catalog_publications_consulta_idx
  ON app.catalog_publications (source_id, referencia DESC, regime, status);

CREATE TABLE IF NOT EXISTS app.catalog_items (
  publication_id uuid NOT NULL REFERENCES app.catalog_publications(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  tenant_id uuid REFERENCES app.tenants(id),
  tipo text NOT NULL
    CHECK (tipo IN ('composicao', 'insumo', 'mao_obra', 'material', 'equipamento', 'servico_auxiliar')),
  codigo text NOT NULL,
  descricao text NOT NULL,
  unidade text NOT NULL DEFAULT '',
  classificacao text NOT NULL DEFAULT '',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publication_id, id),
  UNIQUE (publication_id, tipo, codigo)
);

CREATE INDEX IF NOT EXISTS catalog_items_pesquisa_idx
  ON app.catalog_items (publication_id, tipo, codigo);

CREATE TABLE IF NOT EXISTS app.catalog_prices (
  publication_id uuid NOT NULL,
  item_id uuid NOT NULL,
  tenant_id uuid REFERENCES app.tenants(id),
  uf text NOT NULL DEFAULT 'BR' CHECK (length(uf) BETWEEN 2 AND 8),
  preco numeric(18,6),
  percentual_mao_obra numeric(9,6),
  custo_mao_obra numeric(18,6),
  custo_material numeric(18,6),
  custo_equipamento numeric(18,6),
  sem_preco boolean NOT NULL DEFAULT false,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (publication_id, item_id, uf),
  FOREIGN KEY (publication_id, item_id)
    REFERENCES app.catalog_items(publication_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app.catalog_composition_components (
  publication_id uuid NOT NULL,
  composition_item_id uuid NOT NULL,
  sequencia integer NOT NULL CHECK (sequencia > 0),
  tenant_id uuid REFERENCES app.tenants(id),
  componente_tipo text NOT NULL
    CHECK (componente_tipo IN ('composicao', 'insumo', 'mao_obra', 'material', 'equipamento', 'servico_auxiliar')),
  componente_codigo text NOT NULL,
  coeficiente numeric(24,12) NOT NULL CHECK (coeficiente >= 0),
  unidade text NOT NULL DEFAULT '',
  preco_basico numeric(18,6),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (publication_id, composition_item_id, sequencia),
  FOREIGN KEY (publication_id, composition_item_id)
    REFERENCES app.catalog_items(publication_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS catalog_components_referencia_idx
  ON app.catalog_composition_components (publication_id, componente_tipo, componente_codigo);

CREATE TABLE IF NOT EXISTS app.own_compositions (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id text NOT NULL,
  codigo text NOT NULL,
  descricao text NOT NULL,
  unidade text NOT NULL DEFAULT '',
  custo_unitario numeric(18,6) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('ativa', 'inativa', 'arquivada')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, codigo)
);

CREATE TABLE IF NOT EXISTS app.own_composition_components (
  tenant_id uuid NOT NULL,
  composition_id text NOT NULL,
  sequencia integer NOT NULL CHECK (sequencia > 0),
  base_preco_id text NOT NULL DEFAULT '',
  referencia_tipo text NOT NULL,
  referencia_codigo text NOT NULL,
  coeficiente numeric(24,12) NOT NULL CHECK (coeficiente >= 0),
  preco numeric(18,6),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (tenant_id, composition_id, sequencia),
  FOREIGN KEY (tenant_id, composition_id)
    REFERENCES app.own_compositions(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app.tenant_settings (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  chave text NOT NULL,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_por text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, chave)
);

CREATE TABLE IF NOT EXISTS app.migration_batches (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid,
  contrato integer NOT NULL CHECK (contrato > 0),
  hash text NOT NULL CHECK (length(hash) = 64),
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido', 'validando', 'validado', 'rejeitado', 'homologando', 'homologado', 'cancelado')),
  contagens jsonb NOT NULL DEFAULT '{}'::jsonb,
  erros jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  validado_por text,
  validado_em timestamptz,
  homologado_por text,
  homologado_em timestamptz,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, hash),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS app.migration_batch_records (
  tenant_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  dominio_id text NOT NULL
    CHECK (dominio_id IN ('orcamentos', 'composicoes-proprias', 'bases-precos', 'configuracoes')),
  sequencia integer NOT NULL CHECK (sequencia > 0),
  origem_id text NOT NULL DEFAULT '',
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'valido', 'invalido', 'homologado', 'ignorado')),
  erros jsonb NOT NULL DEFAULT '[]'::jsonb,
  destino_tipo text,
  destino_id text,
  PRIMARY KEY (tenant_id, batch_id, dominio_id, sequencia),
  FOREIGN KEY (tenant_id, batch_id)
    REFERENCES app.migration_batches(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS migration_batches_status_idx
  ON app.migration_batches (tenant_id, status, recebido_em DESC);

INSERT INTO app.permissions (id, module_id, descricao) VALUES
  ('migracao.administrar', 'administracao', 'Enviar, validar e homologar lotes de migração')
ON CONFLICT (id) DO UPDATE
  SET module_id = EXCLUDED.module_id, descricao = EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id)
VALUES ('administrador', 'migracao.administrar')
ON CONFLICT DO NOTHING;

ALTER TABLE app.catalog_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.catalog_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE app.catalog_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.catalog_publications FORCE ROW LEVEL SECURITY;
ALTER TABLE app.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.catalog_items FORCE ROW LEVEL SECURITY;
ALTER TABLE app.catalog_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.catalog_prices FORCE ROW LEVEL SECURITY;
ALTER TABLE app.catalog_composition_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.catalog_composition_components FORCE ROW LEVEL SECURITY;
ALTER TABLE app.own_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.own_compositions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.own_composition_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.own_composition_components FORCE ROW LEVEL SECURITY;
ALTER TABLE app.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tenant_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE app.migration_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.migration_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE app.migration_batch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.migration_batch_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_sources_consulta ON app.catalog_sources;
CREATE POLICY catalog_sources_consulta ON app.catalog_sources FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
DROP POLICY IF EXISTS catalog_sources_escrita ON app.catalog_sources;
CREATE POLICY catalog_sources_escrita ON app.catalog_sources FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS catalog_publications_consulta ON app.catalog_publications;
CREATE POLICY catalog_publications_consulta ON app.catalog_publications FOR SELECT
  USING (
    (tenant_id IS NULL AND status = 'homologada')
    OR tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
  );
DROP POLICY IF EXISTS catalog_publications_escrita ON app.catalog_publications;
CREATE POLICY catalog_publications_escrita ON app.catalog_publications FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS catalog_items_isolamento ON app.catalog_items;
CREATE POLICY catalog_items_isolamento ON app.catalog_items FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    OR (
      tenant_id IS NULL AND EXISTS (
        SELECT 1 FROM app.catalog_publications p
         WHERE p.id = publication_id AND p.tenant_id IS NULL AND p.status = 'homologada'
      )
    )
  )
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS catalog_prices_isolamento ON app.catalog_prices;
CREATE POLICY catalog_prices_isolamento ON app.catalog_prices FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    OR (
      tenant_id IS NULL AND EXISTS (
        SELECT 1 FROM app.catalog_publications p
         WHERE p.id = publication_id AND p.tenant_id IS NULL AND p.status = 'homologada'
      )
    )
  )
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS catalog_components_isolamento ON app.catalog_composition_components;
CREATE POLICY catalog_components_isolamento ON app.catalog_composition_components FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    OR (
      tenant_id IS NULL AND EXISTS (
        SELECT 1 FROM app.catalog_publications p
         WHERE p.id = publication_id AND p.tenant_id IS NULL AND p.status = 'homologada'
      )
    )
  )
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS own_compositions_isolamento ON app.own_compositions;
CREATE POLICY own_compositions_isolamento ON app.own_compositions FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
DROP POLICY IF EXISTS own_components_isolamento ON app.own_composition_components;
CREATE POLICY own_components_isolamento ON app.own_composition_components FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
DROP POLICY IF EXISTS tenant_settings_isolamento ON app.tenant_settings;
CREATE POLICY tenant_settings_isolamento ON app.tenant_settings FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
DROP POLICY IF EXISTS migration_batches_isolamento ON app.migration_batches;
CREATE POLICY migration_batches_isolamento ON app.migration_batches FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  );
DROP POLICY IF EXISTS migration_records_isolamento ON app.migration_batch_records;
CREATE POLICY migration_records_isolamento ON app.migration_batch_records FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
