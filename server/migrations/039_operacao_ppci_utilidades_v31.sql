-- Sprint 31 — operação de PPCI, responsáveis corporativos e utilidades mensuráveis.
UPDATE app.module_catalog_versions SET status='substituida' WHERE status='publicada';
INSERT INTO app.module_catalog_versions(versao,status,descricao,criado_por)
VALUES(16,'publicada','Catálogo modular PRUMO 31.0 — operação PPCI e utilidades','migracao-039');

INSERT INTO app.module_capabilities(module_id,capability_id,nome,versao_catalogo,status) VALUES
 ('regularidade','ppci-sistemas-gerenciaveis','Edição e remoção rastreável de sistemas PPCI',16,'ativa'),
 ('regularidade','ppci-ged-integrado','Documentos PPCI vinculados ao GED',16,'ativa'),
 ('utilidades','medidores-corporativos','Cadastro patrimonial de medidores e utilidades',16,'ativa'),
 ('utilidades','leituras-rastreaveis','Leituras imutáveis de consumo, geração, crédito e débito',16,'ativa')
ON CONFLICT DO NOTHING;

ALTER TABLE app.fire_safety_systems
 ADD COLUMN status text NOT NULL DEFAULT 'ativo' CHECK(status IN('ativo','inativo')),
 ADD COLUMN removido_motivo text NOT NULL DEFAULT '',
 ADD COLUMN removido_por text,
 ADD COLUMN removido_em timestamptz;

CREATE TABLE app.utility_meters(
 tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL,
 patrimonio_unidade_id uuid NOT NULL, ativo_id uuid,
 codigo text NOT NULL, nome text NOT NULL,
 recurso text NOT NULL CHECK(recurso IN('energia','agua','gas','combustivel','outro')),
 unidade text NOT NULL, direcao text NOT NULL DEFAULT 'consumo'
   CHECK(direcao IN('consumo','geracao','bidirecional')),
 multiplicador numeric(18,6) NOT NULL DEFAULT 1 CHECK(multiplicador>0),
 identificador_externo text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'ativo'
   CHECK(status IN('ativo','inativo')),
 responsavel text NOT NULL DEFAULT '', dados jsonb NOT NULL DEFAULT '{}'::jsonb,
 versao bigint NOT NULL DEFAULT 1 CHECK(versao>0),
 criado_por text NOT NULL, atualizado_por text NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,id,team_id), UNIQUE(tenant_id,team_id,codigo),
 FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id),
 FOREIGN KEY(tenant_id,patrimonio_unidade_id,team_id) REFERENCES app.patrimonial_units(tenant_id,id,team_id),
 FOREIGN KEY(tenant_id,ativo_id,team_id) REFERENCES app.patrimonial_assets(tenant_id,id,team_id)
);

CREATE TABLE app.utility_readings(
 tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, meter_id uuid NOT NULL,
 data_leitura timestamptz NOT NULL, valor numeric(24,6) NOT NULL,
 natureza text NOT NULL DEFAULT 'leitura'
   CHECK(natureza IN('leitura','consumo','geracao','credito','debito')),
 origem text NOT NULL DEFAULT 'manual' CHECK(origem IN('manual','importacao','integracao')),
 observacoes text NOT NULL DEFAULT '', documento_id uuid,
 registrado_por text NOT NULL, registrado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,meter_id,team_id) REFERENCES app.utility_meters(tenant_id,id,team_id),
 FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id),
 UNIQUE(tenant_id,meter_id,data_leitura)
);

CREATE OR REPLACE FUNCTION app.validar_medidor_utilidade() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE nivel_local text; status_local text; ativo_sala uuid;
BEGIN
 SELECT nivel,status INTO nivel_local,status_local FROM app.patrimonial_units
  WHERE tenant_id=NEW.tenant_id AND id=NEW.patrimonio_unidade_id AND team_id=NEW.team_id;
 IF nivel_local IS NULL OR nivel_local NOT IN('site','predio','sala') OR status_local<>'ativo' THEN
   RAISE EXCEPTION 'Medidor exige Site, Prédio ou Sala ativo' USING ERRCODE='23514';
 END IF;
 IF NEW.ativo_id IS NOT NULL THEN
   SELECT sala_id INTO ativo_sala FROM app.patrimonial_assets
    WHERE tenant_id=NEW.tenant_id AND id=NEW.ativo_id AND team_id=NEW.team_id;
   IF ativo_sala IS NULL OR ativo_sala<>NEW.patrimonio_unidade_id THEN
     RAISE EXCEPTION 'Ativo do medidor não pertence à Sala informada' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER utility_meters_referencia BEFORE INSERT OR UPDATE ON app.utility_meters
 FOR EACH ROW EXECUTE FUNCTION app.validar_medidor_utilidade();
CREATE TRIGGER utility_readings_imutaveis BEFORE UPDATE OR DELETE ON app.utility_readings
 FOR EACH ROW EXECUTE FUNCTION app.impedir_alteracao_historico();

CREATE INDEX utility_meters_local_idx ON app.utility_meters(tenant_id,team_id,patrimonio_unidade_id,recurso,status);
CREATE INDEX utility_readings_meter_idx ON app.utility_readings(tenant_id,team_id,meter_id,data_leitura DESC);

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['utility_meters','utility_readings'] LOOP
 EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY %I ON app.%I FOR ALL USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND team_id=nullif(current_setting(''app.team_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND team_id=nullif(current_setting(''app.team_id'',true),'''')::uuid)',t||'_isolation',t);
 END LOOP; END $$;

REVOKE ALL ON FUNCTION app.validar_medidor_utilidade() FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON app.utility_meters TO prumo_api;
GRANT SELECT,INSERT ON app.utility_readings TO prumo_api;
