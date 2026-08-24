CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.tenants (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.teams (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS app.memberships (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  identity_subject text NOT NULL,
  perfil_id text NOT NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, identity_subject)
);

CREATE TABLE IF NOT EXISTS app.team_memberships (
  tenant_id uuid NOT NULL,
  team_id uuid NOT NULL,
  identity_subject text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, team_id, identity_subject),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id),
  FOREIGN KEY (tenant_id, identity_subject)
    REFERENCES app.memberships(tenant_id, identity_subject)
);

CREATE TABLE IF NOT EXISTS app.orcamentos (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid,
  nome text NOT NULL,
  versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id)
);

CREATE INDEX IF NOT EXISTS orcamentos_tenant_team_atualizado_idx
  ON app.orcamentos (tenant_id, team_id, atualizado_em DESC);

CREATE TABLE IF NOT EXISTS app.idempotency_keys (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  chave text NOT NULL,
  resposta jsonb NOT NULL,
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (tenant_id, chave)
);

CREATE OR REPLACE FUNCTION app.ativar_contexto(
  p_tenant_id uuid,
  p_identity_subject text,
  p_team_id uuid DEFAULT NULL
)
RETURNS TABLE (tenant_nome text, perfil_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
DECLARE
  v_tenant_nome text;
  v_perfil_id text;
BEGIN
  SELECT t.nome, m.perfil_id
    INTO v_tenant_nome, v_perfil_id
    FROM app.tenants t
    JOIN app.memberships m ON m.tenant_id = t.id
   WHERE t.id = p_tenant_id
     AND t.status = 'ativo'
     AND m.identity_subject = p_identity_subject
     AND m.status = 'ativo';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'empresa não autorizada' USING ERRCODE = '42501';
  END IF;

  IF p_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM app.teams t
      JOIN app.team_memberships tm
        ON tm.tenant_id = t.tenant_id AND tm.team_id = t.id
     WHERE t.tenant_id = p_tenant_id
       AND t.id = p_team_id
       AND t.status = 'ativo'
       AND tm.identity_subject = p_identity_subject
  ) THEN
    RAISE EXCEPTION 'equipe não autorizada' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.tenant_id', p_tenant_id::text, true);
  PERFORM set_config('app.identity_subject', p_identity_subject, true);
  PERFORM set_config('app.team_id', coalesce(p_team_id::text, ''), true);

  RETURN QUERY SELECT v_tenant_nome, v_perfil_id;
END;
$$;

REVOKE ALL ON FUNCTION app.ativar_contexto(uuid, text, uuid) FROM PUBLIC;

ALTER TABLE app.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.orcamentos FORCE ROW LEVEL SECURITY;
ALTER TABLE app.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.idempotency_keys FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orcamentos_isolamento ON app.orcamentos;
CREATE POLICY orcamentos_isolamento
  ON app.orcamentos
  FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (
      team_id IS NULL
      OR team_id = nullif(current_setting('app.team_id', true), '')::uuid
    )
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (
      team_id IS NULL
      OR team_id = nullif(current_setting('app.team_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS idempotency_isolamento ON app.idempotency_keys;
CREATE POLICY idempotency_isolamento
  ON app.idempotency_keys
  FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
  );

COMMENT ON FUNCTION app.ativar_contexto(uuid, text, uuid) IS
  'Valida o vínculo autenticado antes de configurar tenant e equipe na transação.';
