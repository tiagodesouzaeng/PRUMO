INSERT INTO app.modules (id, nome, ordem, status)
VALUES ('patrimonio', 'Patrimônio e Espaços', 15, 'ativo')
ON CONFLICT (id) DO UPDATE
  SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, status = EXCLUDED.status;

INSERT INTO app.permissions (id, module_id, descricao) VALUES
  ('patrimonio.consultar', 'patrimonio', 'Consultar a hierarquia patrimonial e seus ativos'),
  ('patrimonio.editar', 'patrimonio', 'Cadastrar e alterar unidades e ativos patrimoniais'),
  ('patrimonio.movimentar', 'patrimonio', 'Movimentar ativos entre salas')
ON CONFLICT (id) DO UPDATE
  SET module_id = EXCLUDED.module_id, descricao = EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id)
SELECT 'administrador', id FROM app.permissions
WHERE id LIKE 'patrimonio.%'
ON CONFLICT DO NOTHING;

INSERT INTO app.default_profile_permissions (perfil_id, permission_id) VALUES
  ('gestor', 'patrimonio.consultar'),
  ('gestor', 'patrimonio.editar'),
  ('gestor', 'patrimonio.movimentar'),
  ('orcamentista', 'patrimonio.consultar'),
  ('fiscal', 'patrimonio.consultar'),
  ('fiscal', 'patrimonio.movimentar'),
  ('aprovador', 'patrimonio.consultar'),
  ('consulta', 'patrimonio.consultar')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  empresa record;
BEGIN
  FOR empresa IN SELECT id FROM app.tenants LOOP
    PERFORM set_config('app.tenant_id', empresa.id::text, true);
    INSERT INTO app.tenant_modules (tenant_id, module_id, status)
    VALUES (empresa.id, 'patrimonio', 'ativo')
    ON CONFLICT (tenant_id, module_id) DO UPDATE SET status = 'ativo';

    INSERT INTO app.tenant_module_contracts
      (tenant_id, module_id, disponivel, contratado, habilitado, pacote, atualizado_por)
    VALUES (empresa.id, 'patrimonio', true, true, true, 'plataforma', 'migracao-012')
    ON CONFLICT (tenant_id, module_id) DO NOTHING;
  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
END;
$$;

UPDATE app.module_catalog_versions SET status = 'substituida' WHERE status = 'publicada';
INSERT INTO app.module_catalog_versions (versao, status, descricao, criado_por)
VALUES (2, 'publicada', 'Catálogo modular PRUMO 11.0', 'migracao-012');

INSERT INTO app.module_capabilities
  (module_id, capability_id, nome, versao_catalogo, status)
VALUES
  ('patrimonio', 'hierarquia-patrimonial-canonica', 'Hierarquia Cliente · Site · Prédio · Sala', 2, 'ativa'),
  ('patrimonio', 'ativos-e-movimentacoes', 'Ativos, equipamentos e movimentações entre salas', 2, 'ativa'),
  ('obras', 'referencia-patrimonial', 'Empreendimentos vinculados ao cadastro patrimonial', 2, 'ativa')
ON CONFLICT DO NOTHING;

INSERT INTO app.module_dependencies (module_id, depends_on_module_id, obrigatoria)
VALUES ('obras', 'patrimonio', true)
ON CONFLICT (module_id, depends_on_module_id) DO UPDATE
  SET obrigatoria = EXCLUDED.obrigatoria;

CREATE TABLE app.patrimonial_units (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid NOT NULL,
  parent_id uuid,
  nivel text NOT NULL CHECK (nivel IN ('cliente', 'site', 'predio', 'sala')),
  codigo text NOT NULL,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  endereco jsonb NOT NULL DEFAULT '{}'::jsonb,
  area_m2 numeric(18,2) CHECK (area_m2 IS NULL OR area_m2 >= 0),
  responsavel text NOT NULL DEFAULT '',
  ocupacao text NOT NULL DEFAULT '',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  criado_por text NOT NULL,
  atualizado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, id, team_id),
  UNIQUE (tenant_id, team_id, nivel, codigo),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id),
  FOREIGN KEY (tenant_id, parent_id, team_id)
    REFERENCES app.patrimonial_units(tenant_id, id, team_id),
  CHECK (btrim(codigo) <> ''),
  CHECK (btrim(nome) <> ''),
  CHECK (id <> parent_id)
);

CREATE INDEX patrimonial_units_tree_idx
  ON app.patrimonial_units (tenant_id, team_id, parent_id, nivel, nome);
CREATE INDEX patrimonial_units_status_idx
  ON app.patrimonial_units (tenant_id, team_id, status, nivel);

CREATE TABLE app.patrimonial_assets (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid NOT NULL,
  sala_id uuid NOT NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'equipamento',
  numero_patrimonio text NOT NULL DEFAULT '',
  fabricante text NOT NULL DEFAULT '',
  modelo text NOT NULL DEFAULT '',
  numero_serie text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'em_manutencao', 'inativo', 'baixado')),
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
  FOREIGN KEY (tenant_id, sala_id, team_id)
    REFERENCES app.patrimonial_units(tenant_id, id, team_id),
  CHECK (btrim(codigo) <> ''),
  CHECK (btrim(nome) <> '')
);

CREATE INDEX patrimonial_assets_room_idx
  ON app.patrimonial_assets (tenant_id, team_id, sala_id, status, nome);

CREATE TABLE app.patrimonial_movements (
  tenant_id uuid NOT NULL REFERENCES app.tenants(id),
  id uuid NOT NULL,
  team_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  origem_sala_id uuid NOT NULL,
  destino_sala_id uuid NOT NULL,
  motivo text NOT NULL,
  movimentado_por text NOT NULL,
  movimentado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, team_id) REFERENCES app.teams(tenant_id, id),
  FOREIGN KEY (tenant_id, asset_id, team_id)
    REFERENCES app.patrimonial_assets(tenant_id, id, team_id),
  FOREIGN KEY (tenant_id, origem_sala_id, team_id)
    REFERENCES app.patrimonial_units(tenant_id, id, team_id),
  FOREIGN KEY (tenant_id, destino_sala_id, team_id)
    REFERENCES app.patrimonial_units(tenant_id, id, team_id),
  CHECK (origem_sala_id <> destino_sala_id),
  CHECK (btrim(motivo) <> '')
);

CREATE INDEX patrimonial_movements_asset_idx
  ON app.patrimonial_movements (tenant_id, team_id, asset_id, movimentado_em DESC);

CREATE OR REPLACE FUNCTION app.validar_hierarquia_patrimonial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  nivel_pai text;
  status_pai text;
  nivel_esperado text;
BEGIN
  IF NEW.nivel = 'cliente' THEN
    IF NEW.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cliente não pode possuir unidade pai' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  nivel_esperado := CASE NEW.nivel
    WHEN 'site' THEN 'cliente'
    WHEN 'predio' THEN 'site'
    WHEN 'sala' THEN 'predio'
  END;

  IF NEW.parent_id IS NULL THEN
    RAISE EXCEPTION 'A unidade % exige unidade pai', NEW.nivel USING ERRCODE = '23514';
  END IF;

  SELECT nivel, status INTO nivel_pai, status_pai
    FROM app.patrimonial_units
   WHERE tenant_id = NEW.tenant_id
     AND id = NEW.parent_id
     AND team_id = NEW.team_id;

  IF nivel_pai IS DISTINCT FROM nivel_esperado THEN
    RAISE EXCEPTION 'Hierarquia inválida: % deve pertencer a %', NEW.nivel, nivel_esperado
      USING ERRCODE = '23514';
  END IF;
  IF status_pai <> 'ativo' THEN
    RAISE EXCEPTION 'A unidade pai precisa estar ativa' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER patrimonial_units_validar_hierarquia
BEFORE INSERT OR UPDATE OF parent_id, nivel, team_id, tenant_id
ON app.patrimonial_units
FOR EACH ROW EXECUTE FUNCTION app.validar_hierarquia_patrimonial();

CREATE OR REPLACE FUNCTION app.proteger_desativacao_patrimonial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'ativo' AND NEW.status = 'inativo' THEN
    IF EXISTS (
      SELECT 1 FROM app.patrimonial_units
       WHERE tenant_id = NEW.tenant_id AND parent_id = NEW.id AND status = 'ativo'
    ) THEN
      RAISE EXCEPTION 'Desative primeiro as unidades filhas' USING ERRCODE = '23514';
    END IF;
    IF NEW.nivel = 'sala' AND EXISTS (
      SELECT 1 FROM app.patrimonial_assets
       WHERE tenant_id = NEW.tenant_id AND sala_id = NEW.id
         AND status NOT IN ('inativo', 'baixado')
    ) THEN
      RAISE EXCEPTION 'A sala possui ativos em operação' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER patrimonial_units_proteger_desativacao
BEFORE UPDATE OF status ON app.patrimonial_units
FOR EACH ROW EXECUTE FUNCTION app.proteger_desativacao_patrimonial();

CREATE OR REPLACE FUNCTION app.validar_sala_ativo_patrimonial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sala_nivel text;
  sala_status text;
BEGIN
  SELECT nivel, status INTO sala_nivel, sala_status
    FROM app.patrimonial_units
   WHERE tenant_id = NEW.tenant_id
     AND id = NEW.sala_id
     AND team_id = NEW.team_id;
  IF sala_nivel IS DISTINCT FROM 'sala' THEN
    RAISE EXCEPTION 'Ativos somente podem ser vinculados a salas' USING ERRCODE = '23514';
  END IF;
  IF sala_status <> 'ativo' THEN
    RAISE EXCEPTION 'A sala precisa estar ativa' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER patrimonial_assets_validar_sala
BEFORE INSERT OR UPDATE OF sala_id, team_id, tenant_id
ON app.patrimonial_assets
FOR EACH ROW EXECUTE FUNCTION app.validar_sala_ativo_patrimonial();

ALTER TABLE app.empreendimentos ADD COLUMN patrimonio_unidade_id uuid;
ALTER TABLE app.empreendimentos
  ADD CONSTRAINT empreendimentos_patrimonio_unidade_fk
  FOREIGN KEY (tenant_id, patrimonio_unidade_id)
  REFERENCES app.patrimonial_units(tenant_id, id);
CREATE INDEX empreendimentos_patrimonio_idx
  ON app.empreendimentos (tenant_id, patrimonio_unidade_id);

ALTER TABLE app.patrimonial_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.patrimonial_units FORCE ROW LEVEL SECURITY;
ALTER TABLE app.patrimonial_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.patrimonial_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE app.patrimonial_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.patrimonial_movements FORCE ROW LEVEL SECURITY;

CREATE POLICY patrimonial_units_isolamento ON app.patrimonial_units FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid
  );

CREATE POLICY patrimonial_assets_isolamento ON app.patrimonial_assets FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid
  );

CREATE POLICY patrimonial_movements_isolamento ON app.patrimonial_movements FOR ALL
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND team_id = nullif(current_setting('app.team_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE ON app.patrimonial_units, app.patrimonial_assets TO prumo_api;
GRANT SELECT, INSERT ON app.patrimonial_movements TO prumo_api;
