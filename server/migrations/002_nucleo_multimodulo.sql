CREATE TABLE IF NOT EXISTS app.modules (
  id text PRIMARY KEY,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo'))
);

CREATE TABLE IF NOT EXISTS app.tenant_modules (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  module_id text NOT NULL REFERENCES app.modules(id),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (tenant_id, module_id)
);

CREATE TABLE IF NOT EXISTS app.permissions (
  id text PRIMARY KEY,
  module_id text NOT NULL REFERENCES app.modules(id),
  descricao text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS app.default_profile_permissions (
  perfil_id text NOT NULL,
  permission_id text NOT NULL REFERENCES app.permissions(id),
  PRIMARY KEY (perfil_id, permission_id)
);

CREATE TABLE IF NOT EXISTS app.tenant_profile_permissions (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  perfil_id text NOT NULL,
  permission_id text NOT NULL REFERENCES app.permissions(id),
  permitido boolean NOT NULL,
  PRIMARY KEY (tenant_id, perfil_id, permission_id)
);

INSERT INTO app.modules (id, nome, ordem) VALUES
  ('visao-geral', 'Visão Geral', 10),
  ('obras', 'Obras e Contratos', 20),
  ('orcamentos', 'Orçamentos e Composições', 30),
  ('bases-precos', 'Bases de Preços', 40),
  ('suprimentos', 'Suprimentos e Aquisições', 50),
  ('medicoes', 'Medições e Fiscalização', 60),
  ('manutencao', 'Manutenção', 70),
  ('ppci', 'PPCI', 80),
  ('utilidades', 'Consumos e Utilidades', 90),
  ('documentos', 'Documentos e GED', 100),
  ('relatorios', 'Relatórios', 110),
  ('administracao', 'Administração', 120)
ON CONFLICT (id) DO UPDATE
  SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem;

INSERT INTO app.permissions (id, module_id, descricao) VALUES
  ('plataforma.consultar', 'visao-geral', 'Consultar a plataforma'),
  ('empreendimento.consultar', 'obras', 'Consultar empreendimentos'),
  ('empreendimento.editar', 'obras', 'Editar empreendimentos'),
  ('orcamento.consultar', 'orcamentos', 'Consultar orçamentos'),
  ('orcamento.editar', 'orcamentos', 'Editar orçamentos'),
  ('orcamento.revisar', 'orcamentos', 'Criar revisões'),
  ('orcamento.aprovar', 'orcamentos', 'Aprovar orçamentos'),
  ('bases.consultar', 'bases-precos', 'Consultar bases de preços'),
  ('bases.administrar', 'bases-precos', 'Administrar bases de preços'),
  ('suprimentos.consultar', 'suprimentos', 'Consultar suprimentos'),
  ('suprimentos.editar', 'suprimentos', 'Editar suprimentos'),
  ('medicao.consultar', 'medicoes', 'Consultar medições'),
  ('medicao.registrar', 'medicoes', 'Registrar medições'),
  ('medicao.aprovar', 'medicoes', 'Aprovar medições'),
  ('manutencao.consultar', 'manutencao', 'Consultar manutenção'),
  ('manutencao.editar', 'manutencao', 'Editar manutenção'),
  ('ppci.consultar', 'ppci', 'Consultar PPCI'),
  ('ppci.editar', 'ppci', 'Editar PPCI'),
  ('utilidades.consultar', 'utilidades', 'Consultar consumos e utilidades'),
  ('documentos.consultar', 'documentos', 'Consultar documentos'),
  ('documentos.editar', 'documentos', 'Editar documentos'),
  ('relatorios.consultar', 'relatorios', 'Consultar relatórios'),
  ('administracao.acessar', 'administracao', 'Acessar administração'),
  ('auditoria.consultar', 'administracao', 'Consultar auditoria')
ON CONFLICT (id) DO UPDATE
  SET module_id = EXCLUDED.module_id, descricao = EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id)
SELECT 'administrador', id FROM app.permissions
ON CONFLICT DO NOTHING;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id) VALUES
  ('gestor', 'plataforma.consultar'),
  ('gestor', 'empreendimento.consultar'),
  ('gestor', 'empreendimento.editar'),
  ('gestor', 'orcamento.consultar'),
  ('gestor', 'orcamento.editar'),
  ('gestor', 'orcamento.revisar'),
  ('gestor', 'orcamento.aprovar'),
  ('gestor', 'bases.consultar'),
  ('gestor', 'suprimentos.consultar'),
  ('gestor', 'suprimentos.editar'),
  ('gestor', 'medicao.consultar'),
  ('gestor', 'medicao.registrar'),
  ('gestor', 'medicao.aprovar'),
  ('gestor', 'manutencao.consultar'),
  ('gestor', 'ppci.consultar'),
  ('gestor', 'documentos.consultar'),
  ('gestor', 'documentos.editar'),
  ('gestor', 'auditoria.consultar'),
  ('orcamentista', 'plataforma.consultar'),
  ('orcamentista', 'empreendimento.consultar'),
  ('orcamentista', 'orcamento.consultar'),
  ('orcamentista', 'orcamento.editar'),
  ('orcamentista', 'orcamento.revisar'),
  ('orcamentista', 'bases.consultar'),
  ('orcamentista', 'suprimentos.consultar'),
  ('orcamentista', 'documentos.consultar'),
  ('fiscal', 'plataforma.consultar'),
  ('fiscal', 'empreendimento.consultar'),
  ('fiscal', 'orcamento.consultar'),
  ('fiscal', 'medicao.consultar'),
  ('fiscal', 'medicao.registrar'),
  ('fiscal', 'documentos.consultar'),
  ('fiscal', 'documentos.editar'),
  ('aprovador', 'plataforma.consultar'),
  ('aprovador', 'empreendimento.consultar'),
  ('aprovador', 'orcamento.consultar'),
  ('aprovador', 'orcamento.aprovar'),
  ('aprovador', 'medicao.consultar'),
  ('aprovador', 'medicao.aprovar'),
  ('aprovador', 'documentos.consultar'),
  ('aprovador', 'auditoria.consultar')
ON CONFLICT DO NOTHING;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id)
SELECT 'consulta', id
  FROM app.permissions
 WHERE id = 'plataforma.consultar' OR id LIKE '%.consultar'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS app.organizational_units (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  parent_id uuid,
  codigo text NOT NULL DEFAULT '',
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'unidade',
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, parent_id)
    REFERENCES app.organizational_units(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS app.empreendimentos (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid,
  unidade_id uuid,
  codigo text NOT NULL DEFAULT '',
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'obra',
  status text NOT NULL DEFAULT 'planejamento',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id),
  FOREIGN KEY (tenant_id, unidade_id)
    REFERENCES app.organizational_units(tenant_id, id)
);

CREATE INDEX IF NOT EXISTS empreendimentos_tenant_team_idx
  ON app.empreendimentos (tenant_id, team_id, atualizado_em DESC);

CREATE TABLE IF NOT EXISTS app.orcamento_revisoes (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  team_id uuid,
  orcamento_id uuid NOT NULL,
  numero integer NOT NULL CHECK (numero > 0),
  tipo text NOT NULL CHECK (tipo IN ('original', 'revisao', 'aditivo', 'supressao')),
  status text NOT NULL DEFAULT 'rascunho',
  impacto_valor numeric(18,2) NOT NULL DEFAULT 0,
  impacto_prazo_dias integer NOT NULL DEFAULT 0,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, orcamento_id, numero),
  UNIQUE (tenant_id, orcamento_id, id),
  FOREIGN KEY (tenant_id, orcamento_id) REFERENCES app.orcamentos(tenant_id, id),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS app.medicoes (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  team_id uuid,
  orcamento_id uuid NOT NULL,
  revisao_id uuid,
  numero integer NOT NULL CHECK (numero > 0),
  status text NOT NULL DEFAULT 'rascunho',
  periodo_inicio date,
  periodo_fim date,
  valor_bruto numeric(18,2) NOT NULL DEFAULT 0,
  retencoes numeric(18,2) NOT NULL DEFAULT 0,
  multas numeric(18,2) NOT NULL DEFAULT 0,
  valor_liquido numeric(18,2)
    GENERATED ALWAYS AS (valor_bruto - retencoes - multas) STORED,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (retencoes + multas <= valor_bruto),
  CHECK (periodo_fim IS NULL OR periodo_inicio IS NULL OR periodo_fim >= periodo_inicio),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, orcamento_id, numero),
  FOREIGN KEY (tenant_id, orcamento_id) REFERENCES app.orcamentos(tenant_id, id),
  FOREIGN KEY (tenant_id, orcamento_id, revisao_id)
    REFERENCES app.orcamento_revisoes(tenant_id, orcamento_id, id),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS app.domain_events (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  module_id text NOT NULL REFERENCES app.modules(id),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS domain_events_dispatch_idx
  ON app.domain_events (tenant_id, criado_em);

ALTER TABLE app.tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tenant_modules FORCE ROW LEVEL SECURITY;
ALTER TABLE app.tenant_profile_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tenant_profile_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.organizational_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organizational_units FORCE ROW LEVEL SECURITY;
ALTER TABLE app.empreendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.empreendimentos FORCE ROW LEVEL SECURITY;
ALTER TABLE app.orcamento_revisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.orcamento_revisoes FORCE ROW LEVEL SECURITY;
ALTER TABLE app.medicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.medicoes FORCE ROW LEVEL SECURITY;
ALTER TABLE app.domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.domain_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_modules_isolamento ON app.tenant_modules;
CREATE POLICY tenant_modules_isolamento ON app.tenant_modules FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_profile_permissions_isolamento ON app.tenant_profile_permissions;
CREATE POLICY tenant_profile_permissions_isolamento ON app.tenant_profile_permissions FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS organizational_units_isolamento ON app.organizational_units;
CREATE POLICY organizational_units_isolamento ON app.organizational_units FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS empreendimentos_isolamento ON app.empreendimentos;
CREATE POLICY empreendimentos_isolamento ON app.empreendimentos FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  );

DROP POLICY IF EXISTS orcamento_revisoes_isolamento ON app.orcamento_revisoes;
CREATE POLICY orcamento_revisoes_isolamento ON app.orcamento_revisoes FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  );

DROP POLICY IF EXISTS medicoes_isolamento ON app.medicoes;
CREATE POLICY medicoes_isolamento ON app.medicoes FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  );

DROP POLICY IF EXISTS domain_events_isolamento ON app.domain_events;
CREATE POLICY domain_events_isolamento ON app.domain_events FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
