INSERT INTO app.modules (id, nome, ordem, status)
VALUES ('planejamento', 'Demandas e Investimentos', 18, 'ativo')
ON CONFLICT (id) DO UPDATE
  SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, status = EXCLUDED.status;

INSERT INTO app.permissions (id, module_id, descricao) VALUES
  ('planejamento.consultar', 'planejamento', 'Consultar demandas, programas e carteiras de investimentos'),
  ('planejamento.editar', 'planejamento', 'Cadastrar e editar demandas, programas e carteiras'),
  ('planejamento.priorizar', 'planejamento', 'Analisar e priorizar demandas'),
  ('planejamento.aprovar', 'planejamento', 'Aprovar, rejeitar e incorporar demandas à carteira')
ON CONFLICT (id) DO UPDATE
  SET module_id = EXCLUDED.module_id, descricao = EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id)
SELECT 'administrador', id FROM app.permissions WHERE id LIKE 'planejamento.%'
ON CONFLICT DO NOTHING;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id) VALUES
  ('gestor', 'planejamento.consultar'),
  ('gestor', 'planejamento.editar'),
  ('gestor', 'planejamento.priorizar'),
  ('orcamentista', 'planejamento.consultar'),
  ('fiscal', 'planejamento.consultar'),
  ('aprovador', 'planejamento.consultar'),
  ('aprovador', 'planejamento.aprovar'),
  ('consulta', 'planejamento.consultar')
ON CONFLICT DO NOTHING;

DO $$
DECLARE empresa record;
BEGIN
  FOR empresa IN SELECT id FROM app.tenants LOOP
    PERFORM set_config('app.tenant_id', empresa.id::text, true);
    INSERT INTO app.tenant_modules (tenant_id, module_id, status)
    VALUES (empresa.id, 'planejamento', 'ativo')
    ON CONFLICT (tenant_id, module_id) DO UPDATE SET status = 'ativo';

    INSERT INTO app.tenant_module_contracts
      (tenant_id, module_id, disponivel, contratado, habilitado, pacote, atualizado_por)
    VALUES (empresa.id, 'planejamento', true, true, true, 'plataforma', 'migracao-018')
    ON CONFLICT (tenant_id, module_id) DO NOTHING;
  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
END;
$$;

UPDATE app.module_catalog_versions SET status = 'substituida' WHERE status = 'publicada';
INSERT INTO app.module_catalog_versions (versao, status, descricao, criado_por)
VALUES (3, 'publicada', 'Catálogo modular PRUMO 12.0', 'migracao-018');

INSERT INTO app.module_capabilities
  (module_id, capability_id, nome, versao_catalogo, status)
VALUES
  ('planejamento', 'demandas-priorizadas', 'Demandas vinculadas ao patrimônio com priorização auditável', 3, 'ativa'),
  ('planejamento', 'programas-investimento', 'Programas estratégicos de investimento', 3, 'ativa'),
  ('planejamento', 'carteira-plano-anual', 'Carteira e plano anual com limite financeiro e aprovações', 3, 'ativa')
ON CONFLICT DO NOTHING;

INSERT INTO app.module_dependencies (module_id, depends_on_module_id, obrigatoria)
VALUES ('planejamento', 'patrimonio', true)
ON CONFLICT (module_id, depends_on_module_id) DO UPDATE
  SET obrigatoria = EXCLUDED.obrigatoria;

CREATE TABLE app.investment_programs (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid NOT NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  objetivo text NOT NULL DEFAULT '',
  ano_inicio integer CHECK (ano_inicio IS NULL OR ano_inicio BETWEEN 2000 AND 2200),
  ano_fim integer CHECK (ano_fim IS NULL OR ano_fim BETWEEN 2000 AND 2200),
  limite_financeiro numeric(18,2) NOT NULL DEFAULT 0 CHECK (limite_financeiro >= 0),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'encerrado')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_por text NOT NULL,
  atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, id, team_id),
  UNIQUE (tenant_id, team_id, codigo),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id),
  CHECK (btrim(codigo) <> ''),
  CHECK (btrim(nome) <> ''),
  CHECK (ano_inicio IS NULL OR ano_fim IS NULL OR ano_fim >= ano_inicio)
);

CREATE TABLE app.investment_portfolios (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid NOT NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  ano integer NOT NULL CHECK (ano BETWEEN 2000 AND 2200),
  limite_financeiro numeric(18,2) NOT NULL DEFAULT 0 CHECK (limite_financeiro >= 0),
  status text NOT NULL DEFAULT 'elaboracao' CHECK (status IN ('elaboracao', 'em_aprovacao', 'aprovada', 'encerrada')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_por text NOT NULL,
  atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, id, team_id),
  UNIQUE (tenant_id, team_id, codigo),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id),
  CHECK (btrim(codigo) <> ''),
  CHECK (btrim(nome) <> '')
);

CREATE TABLE app.investment_demands (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid NOT NULL,
  patrimonio_unidade_id uuid NOT NULL,
  programa_id uuid,
  codigo text NOT NULL,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  solicitante text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'obra_reforma' CHECK (categoria IN ('obra_reforma', 'manutencao', 'regularidade', 'eficiencia', 'acessibilidade', 'tecnologia', 'outro')),
  valor_estimado numeric(18,2) NOT NULL DEFAULT 0 CHECK (valor_estimado >= 0),
  data_desejada date,
  urgencia smallint NOT NULL DEFAULT 3 CHECK (urgencia BETWEEN 1 AND 5),
  impacto smallint NOT NULL DEFAULT 3 CHECK (impacto BETWEEN 1 AND 5),
  risco smallint NOT NULL DEFAULT 3 CHECK (risco BETWEEN 1 AND 5),
  alinhamento smallint NOT NULL DEFAULT 3 CHECK (alinhamento BETWEEN 1 AND 5),
  pontuacao numeric(5,2) NOT NULL CHECK (pontuacao BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_analise', 'priorizada', 'aprovada', 'rejeitada', 'incorporada')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_por text NOT NULL,
  atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, id, team_id),
  UNIQUE (tenant_id, team_id, codigo),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id),
  FOREIGN KEY (tenant_id, patrimonio_unidade_id, team_id)
    REFERENCES app.patrimonial_units(tenant_id, id, team_id),
  FOREIGN KEY (tenant_id, programa_id, team_id)
    REFERENCES app.investment_programs(tenant_id, id, team_id),
  CHECK (btrim(codigo) <> ''),
  CHECK (btrim(titulo) <> '')
);

CREATE TABLE app.investment_portfolio_demands (
  tenant_id uuid NOT NULL,
  portfolio_id uuid NOT NULL,
  demand_id uuid NOT NULL,
  team_id uuid NOT NULL,
  ordem integer NOT NULL CHECK (ordem > 0),
  valor_planejado numeric(18,2) NOT NULL DEFAULT 0 CHECK (valor_planejado >= 0),
  observacao text NOT NULL DEFAULT '',
  incorporado_por text NOT NULL,
  incorporado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, portfolio_id, demand_id),
  UNIQUE (tenant_id, portfolio_id, ordem),
  FOREIGN KEY (tenant_id, portfolio_id, team_id)
    REFERENCES app.investment_portfolios(tenant_id, id, team_id),
  FOREIGN KEY (tenant_id, demand_id, team_id)
    REFERENCES app.investment_demands(tenant_id, id, team_id)
);

CREATE TABLE app.investment_demand_decisions (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  team_id uuid NOT NULL,
  demand_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('enviar_analise', 'priorizar', 'aprovar', 'rejeitar', 'reabrir', 'incorporar')),
  status_anterior text NOT NULL,
  status_novo text NOT NULL,
  justificativa text NOT NULL DEFAULT '',
  decidido_por text NOT NULL,
  decidido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, demand_id, team_id)
    REFERENCES app.investment_demands(tenant_id, id, team_id)
);

CREATE INDEX investment_demands_status_score_idx
  ON app.investment_demands (tenant_id, team_id, status, pontuacao DESC);
CREATE INDEX investment_demands_location_idx
  ON app.investment_demands (tenant_id, team_id, patrimonio_unidade_id);
CREATE INDEX investment_portfolios_year_idx
  ON app.investment_portfolios (tenant_id, team_id, ano DESC);
CREATE INDEX investment_decisions_demand_idx
  ON app.investment_demand_decisions (tenant_id, team_id, demand_id, decidido_em DESC);

CREATE OR REPLACE FUNCTION app.validar_demanda_planejamento()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app.patrimonial_units u
     WHERE u.tenant_id = NEW.tenant_id AND u.team_id = NEW.team_id
       AND u.id = NEW.patrimonio_unidade_id AND u.status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'a demanda exige uma unidade patrimonial ativa' USING ERRCODE = '23514';
  END IF;
  IF NEW.programa_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app.investment_programs p
     WHERE p.tenant_id = NEW.tenant_id AND p.team_id = NEW.team_id
       AND p.id = NEW.programa_id AND p.status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'o programa da demanda precisa estar ativo' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER investment_demands_validar
BEFORE INSERT OR UPDATE OF patrimonio_unidade_id, programa_id, team_id, tenant_id
ON app.investment_demands
FOR EACH ROW EXECUTE FUNCTION app.validar_demanda_planejamento();

CREATE OR REPLACE FUNCTION app.validar_incorporacao_carteira()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app.investment_demands d
     WHERE d.tenant_id = NEW.tenant_id AND d.team_id = NEW.team_id
       AND d.id = NEW.demand_id AND d.status IN ('aprovada', 'incorporada')
  ) THEN
    RAISE EXCEPTION 'somente demandas aprovadas podem integrar a carteira' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER investment_portfolio_demands_validar
BEFORE INSERT OR UPDATE ON app.investment_portfolio_demands
FOR EACH ROW EXECUTE FUNCTION app.validar_incorporacao_carteira();

CREATE OR REPLACE FUNCTION app.bloquear_alteracao_decisao_investimento()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.planning_test_cleanup', true) = 'autorizado' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'decisões de demandas são imutáveis' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER investment_demand_decisions_imutaveis
BEFORE UPDATE OR DELETE ON app.investment_demand_decisions
FOR EACH ROW EXECUTE FUNCTION app.bloquear_alteracao_decisao_investimento();

ALTER TABLE app.investment_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.investment_programs FORCE ROW LEVEL SECURITY;
ALTER TABLE app.investment_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.investment_portfolios FORCE ROW LEVEL SECURITY;
ALTER TABLE app.investment_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.investment_demands FORCE ROW LEVEL SECURITY;
ALTER TABLE app.investment_portfolio_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.investment_portfolio_demands FORCE ROW LEVEL SECURITY;
ALTER TABLE app.investment_demand_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.investment_demand_decisions FORCE ROW LEVEL SECURITY;

CREATE POLICY investment_programs_isolamento ON app.investment_programs FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid);
CREATE POLICY investment_portfolios_isolamento ON app.investment_portfolios FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid);
CREATE POLICY investment_demands_isolamento ON app.investment_demands FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid);
CREATE POLICY investment_portfolio_demands_isolamento ON app.investment_portfolio_demands FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid);
CREATE POLICY investment_demand_decisions_isolamento ON app.investment_demand_decisions FOR ALL
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON app.investment_programs, app.investment_portfolios, app.investment_demands TO prumo_api;
GRANT SELECT, INSERT, UPDATE ON app.investment_portfolio_demands TO prumo_api;
GRANT SELECT, INSERT ON app.investment_demand_decisions TO prumo_api;

CREATE OR REPLACE FUNCTION app.limpar_planejamento_tenant_teste(p_tenant_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, pg_temp AS $$
DECLARE
  equipe record;
  total integer := 0;
  removidos integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app.tenants WHERE id = p_tenant_id AND nome LIKE 'Teste %') THEN
    RAISE EXCEPTION 'limpeza permitida somente para organizações de teste' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.tenant_id', p_tenant_id::text, true);
  PERFORM set_config('app.planning_test_cleanup', 'autorizado', true);
  FOR equipe IN SELECT id FROM app.teams WHERE tenant_id = p_tenant_id LOOP
    PERFORM set_config('app.team_id', equipe.id::text, true);
    DELETE FROM app.investment_demand_decisions WHERE tenant_id = p_tenant_id;
    GET DIAGNOSTICS removidos = ROW_COUNT;
    total := total + removidos;
    DELETE FROM app.investment_portfolio_demands WHERE tenant_id = p_tenant_id;
    DELETE FROM app.investment_demands WHERE tenant_id = p_tenant_id;
    DELETE FROM app.investment_portfolios WHERE tenant_id = p_tenant_id;
    DELETE FROM app.investment_programs WHERE tenant_id = p_tenant_id;
  END LOOP;
  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION app.limpar_planejamento_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_planejamento_tenant_teste(uuid) TO prumo_migrator;
