-- PRUMO v10.3 DEV1 — referência histórica do desenho inicial.
-- A migração executável e atualizada da DEV2 está em:
-- server/migrations/001_multiempresa_orcamentos.sql
-- Não aplique este arquivo em produção.

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE app.tenants (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.teams (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  UNIQUE (tenant_id, id)
);

CREATE TABLE app.memberships (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  user_id uuid NOT NULL,
  perfil_id text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE app.orcamentos (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid,
  nome text NOT NULL,
  versao bigint NOT NULL DEFAULT 1,
  dados jsonb NOT NULL,
  criado_por uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id)
);

CREATE INDEX orcamentos_tenant_team_idx
  ON app.orcamentos (tenant_id, team_id, atualizado_em DESC);

ALTER TABLE app.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.orcamentos FORCE ROW LEVEL SECURITY;

CREATE POLICY orcamentos_isolamento_empresa
  ON app.orcamentos
  FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
  );

-- A API deve iniciar uma transação, validar o vínculo autenticado e executar:
-- SET LOCAL app.tenant_id = '<uuid-validado-pelo-servidor>';
-- O valor nunca deve ser aceito apenas porque veio de um cabeçalho do navegador.
-- A role usada pela aplicação não pode ter BYPASSRLS e não deve ser proprietária
-- das tabelas protegidas. Bases públicas globais ficam em tabelas separadas,
-- imutáveis e de somente leitura.
