INSERT INTO app.permissions (id, module_id, descricao) VALUES
  ('auditoria.administrar', 'administracao', 'Administrar políticas de auditoria e retenção')
ON CONFLICT (id) DO UPDATE
  SET module_id = EXCLUDED.module_id, descricao = EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id) VALUES
  ('administrador', 'auditoria.administrar')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS app.audit_events (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  sequencia bigint GENERATED ALWAYS AS IDENTITY,
  team_id uuid,
  module_id text NOT NULL REFERENCES app.modules(id),
  acao text NOT NULL,
  entidade_tipo text NOT NULL,
  entidade_id text NOT NULL,
  usuario_id text NOT NULL,
  resultado text NOT NULL DEFAULT 'sucesso',
  antes jsonb,
  depois jsonb,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash_anterior char(64) NOT NULL DEFAULT repeat('0', 64),
  hash char(64) NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (sequencia),
  UNIQUE (tenant_id, hash),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id),
  CHECK (resultado IN ('sucesso', 'negado', 'falha')),
  CHECK (hash_anterior ~ '^[0-9a-f]{64}$'),
  CHECK (hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS audit_events_consulta_idx
  ON app.audit_events (tenant_id, criado_em DESC, sequencia DESC);
CREATE INDEX IF NOT EXISTS audit_events_modulo_acao_idx
  ON app.audit_events (tenant_id, module_id, acao, criado_em DESC);
CREATE INDEX IF NOT EXISTS audit_events_entidade_idx
  ON app.audit_events (tenant_id, entidade_tipo, entidade_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS audit_events_usuario_idx
  ON app.audit_events (tenant_id, usuario_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS app.audit_policies (
  tenant_id uuid PRIMARY KEY REFERENCES app.tenants(id),
  retencao_dias integer NOT NULL DEFAULT 2555 CHECK (retencao_dias BETWEEN 365 AND 36500),
  frequencia_backup text NOT NULL DEFAULT 'diario'
    CHECK (frequencia_backup IN ('diario', 'semanal', 'mensal')),
  ultimo_backup_em timestamptz,
  ultimo_backup_hash char(64),
  ultimo_teste_restauracao_em timestamptz,
  ultimo_teste_restauracao_ok boolean,
  atualizado_por text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (ultimo_backup_hash IS NULL OR ultimo_backup_hash ~ '^[0-9a-f]{64}$')
);

CREATE OR REPLACE FUNCTION app.bloquear_mutacao_auditoria()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'a trilha de auditoria é imutável' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_imutaveis ON app.audit_events;
CREATE TRIGGER audit_events_imutaveis
BEFORE UPDATE OR DELETE ON app.audit_events
FOR EACH ROW EXECUTE FUNCTION app.bloquear_mutacao_auditoria();

ALTER TABLE app.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE app.audit_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.audit_policies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_isolamento ON app.audit_events;
CREATE POLICY audit_events_isolamento ON app.audit_events
  FOR SELECT
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS audit_events_insercao ON app.audit_events;
CREATE POLICY audit_events_insercao ON app.audit_events
  FOR INSERT
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (
      team_id IS NULL
      OR team_id = nullif(current_setting('app.team_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS audit_policies_isolamento ON app.audit_policies;
CREATE POLICY audit_policies_isolamento ON app.audit_policies
  FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE UPDATE, DELETE ON app.audit_events FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prumo_api') THEN
    GRANT SELECT, INSERT ON app.audit_events TO prumo_api;
    GRANT SELECT, INSERT, UPDATE ON app.audit_policies TO prumo_api;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO prumo_api;
  END IF;
END;
$$;

COMMENT ON TABLE app.audit_events IS
  'Trilha imutável e encadeada de ações corporativas, isolada por organização.';
COMMENT ON TABLE app.audit_policies IS
  'Política de retenção, backup e teste de restauração por organização.';
