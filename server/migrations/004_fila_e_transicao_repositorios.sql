-- PRUMO v10.3 DEV6/DEV7
-- Fila corporativa durável e transição gradual dos repositórios locais.

CREATE TABLE IF NOT EXISTS app.jobs (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid,
  tipo text NOT NULL
    CHECK (tipo IN ('sistema.diagnostico', 'catalogo.importar', 'orcamento.recalcular')),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processando', 'concluido', 'falhou', 'cancelado')),
  prioridade smallint NOT NULL DEFAULT 50 CHECK (prioridade BETWEEN 1 AND 100),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  progresso numeric(5,2) NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  resultado jsonb,
  erro jsonb,
  tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  max_tentativas integer NOT NULL DEFAULT 3 CHECK (max_tentativas BETWEEN 1 AND 10),
  disponivel_em timestamptz NOT NULL DEFAULT now(),
  bloqueado_por text,
  bloqueado_ate timestamptz,
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  iniciado_em timestamptz,
  concluido_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id)
);

CREATE INDEX IF NOT EXISTS jobs_processamento_idx
  ON app.jobs (tenant_id, status, prioridade, disponivel_em, criado_em);

CREATE TABLE IF NOT EXISTS app.job_events (
  tenant_id uuid NOT NULL,
  job_id uuid NOT NULL,
  sequencia bigint GENERATED ALWAYS AS IDENTITY,
  tipo text NOT NULL,
  progresso numeric(5,2),
  mensagem text NOT NULL DEFAULT '',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, job_id, sequencia),
  FOREIGN KEY (tenant_id, job_id)
    REFERENCES app.jobs(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app.repository_transitions (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  team_id uuid,
  dominio_id text NOT NULL
    CHECK (dominio_id IN ('orcamentos', 'composicoes-proprias', 'bases-precos', 'configuracoes')),
  modo text NOT NULL DEFAULT 'local'
    CHECK (modo IN ('local', 'hibrido', 'corporativo')),
  batch_id uuid,
  sincronizado_em timestamptz,
  ativado_por text NOT NULL,
  ativado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, dominio_id),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id),
  FOREIGN KEY (tenant_id, batch_id)
    REFERENCES app.migration_batches(tenant_id, id)
);

INSERT INTO app.permissions (id, module_id, descricao) VALUES
  ('trabalho.consultar', 'administracao', 'Consultar filas e trabalhos assíncronos'),
  ('trabalho.administrar', 'administracao', 'Criar, reprocessar e administrar trabalhos assíncronos'),
  ('repositorio.transicionar', 'administracao', 'Alterar a fonte de dados de um domínio homologado')
ON CONFLICT (id) DO UPDATE
  SET module_id = EXCLUDED.module_id, descricao = EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id) VALUES
  ('administrador', 'trabalho.consultar'),
  ('administrador', 'trabalho.administrar'),
  ('administrador', 'repositorio.transicionar')
ON CONFLICT DO NOTHING;

ALTER TABLE app.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE app.job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.job_events FORCE ROW LEVEL SECURITY;
ALTER TABLE app.repository_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.repository_transitions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jobs_isolamento ON app.jobs;
CREATE POLICY jobs_isolamento ON app.jobs FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  );

DROP POLICY IF EXISTS job_events_isolamento ON app.job_events;
CREATE POLICY job_events_isolamento ON app.job_events FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS repository_transitions_isolamento ON app.repository_transitions;
CREATE POLICY repository_transitions_isolamento ON app.repository_transitions FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (team_id IS NULL OR team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  );
