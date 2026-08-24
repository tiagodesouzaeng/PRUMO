-- Sprint 30 — PPCI local, patrimonial e consolidado em Regularidade.
UPDATE app.module_catalog_versions SET status='substituida' WHERE status='publicada';
INSERT INTO app.module_catalog_versions(versao,status,descricao,criado_por)
VALUES(15,'publicada','Catálogo modular PRUMO 30.0 — PPCI local e patrimonial','migracao-037');

INSERT INTO app.module_capabilities(module_id,capability_id,nome,versao_catalogo,status) VALUES
 ('regularidade','ppci-local-patrimonial','PPCI local vinculado a Site, Prédio, Sala e ativos',15,'ativa'),
 ('regularidade','seguranca-predial-inspecoes','Sistemas e inspeções de segurança predial',15,'ativa')
ON CONFLICT DO NOTHING;

DELETE FROM app.module_dependencies WHERE module_id='regularidade' AND depends_on_module_id='ppci';

CREATE TABLE app.fire_safety_plans(
 tenant_id uuid NOT NULL REFERENCES app.tenants(id), id uuid NOT NULL, team_id uuid NOT NULL,
 patrimonio_unidade_id uuid NOT NULL, codigo text NOT NULL, numero_processo text NOT NULL DEFAULT '', titulo text NOT NULL,
 ocupacao text NOT NULL DEFAULT '', classificacao_risco text NOT NULL DEFAULT 'medio' CHECK(classificacao_risco IN('baixo','medio','alto','especial')),
 area_protegida_m2 numeric(18,2) CHECK(area_protegida_m2 IS NULL OR area_protegida_m2>=0), orgao_responsavel text NOT NULL DEFAULT '',
 fase text NOT NULL DEFAULT 'levantamento' CHECK(fase IN('levantamento','projeto','protocolado','analise','exigencia','vistoria','concluido')),
 status text NOT NULL DEFAULT 'em_elaboracao' CHECK(status IN('em_elaboracao','protocolado','em_analise','exigencia','aprovado','suspenso','dispensado','cancelado')),
 data_protocolo date, data_aprovacao date, data_validade date, responsavel text NOT NULL DEFAULT '', proximo_passo text NOT NULL DEFAULT '',
 documento_id uuid, dados jsonb NOT NULL DEFAULT '{}'::jsonb, versao bigint NOT NULL DEFAULT 1 CHECK(versao>0),
 criado_por text NOT NULL, atualizado_por text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,id,team_id), UNIQUE(tenant_id,team_id,codigo),
 FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id),
 FOREIGN KEY(tenant_id,patrimonio_unidade_id,team_id) REFERENCES app.patrimonial_units(tenant_id,id,team_id)
);

CREATE TABLE app.fire_safety_systems(
 tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, plan_id uuid NOT NULL,
 patrimonio_unidade_id uuid NOT NULL, ativo_id uuid, tipo text NOT NULL CHECK(tipo IN('extintores','hidrantes','alarme','deteccao','iluminacao','sinalizacao','saidas','sprinklers','spda','gas','outro')),
 descricao text NOT NULL, quantidade numeric(14,3) NOT NULL DEFAULT 0 CHECK(quantidade>=0), unidade text NOT NULL DEFAULT 'un',
 conformidade text NOT NULL DEFAULT 'nao_avaliado' CHECK(conformidade IN('nao_avaliado','conforme','nao_conforme','nao_aplicavel')),
 ultima_inspecao date, proxima_inspecao date, responsavel text NOT NULL DEFAULT '', dados jsonb NOT NULL DEFAULT '{}'::jsonb,
 versao bigint NOT NULL DEFAULT 1 CHECK(versao>0), criado_por text NOT NULL, atualizado_por text NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,id,team_id),
 FOREIGN KEY(tenant_id,plan_id,team_id) REFERENCES app.fire_safety_plans(tenant_id,id,team_id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,patrimonio_unidade_id,team_id) REFERENCES app.patrimonial_units(tenant_id,id,team_id),
 FOREIGN KEY(tenant_id,ativo_id,team_id) REFERENCES app.patrimonial_assets(tenant_id,id,team_id)
);

CREATE TABLE app.fire_safety_inspections(
 tenant_id uuid NOT NULL, id uuid NOT NULL, team_id uuid NOT NULL, plan_id uuid NOT NULL, system_id uuid,
 data_inspecao date NOT NULL, tipo text NOT NULL CHECK(tipo IN('interna','preventiva','bombeiros','certificacao','teste')),
 resultado text NOT NULL CHECK(resultado IN('conforme','ressalva','nao_conforme')), inspetor text NOT NULL, observacoes text NOT NULL DEFAULT '',
 evidencias jsonb NOT NULL DEFAULT '[]'::jsonb, registrado_por text NOT NULL, registrado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,plan_id,team_id) REFERENCES app.fire_safety_plans(tenant_id,id,team_id),
 FOREIGN KEY(tenant_id,system_id,team_id) REFERENCES app.fire_safety_systems(tenant_id,id,team_id),
 FOREIGN KEY(tenant_id,team_id) REFERENCES app.teams(tenant_id,id)
);

CREATE OR REPLACE FUNCTION app.validar_local_ppci() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE nivel_local text; status_local text;
BEGIN
 SELECT nivel,status INTO nivel_local,status_local FROM app.patrimonial_units
  WHERE tenant_id=NEW.tenant_id AND id=NEW.patrimonio_unidade_id AND team_id=NEW.team_id;
 IF nivel_local IS NULL OR nivel_local NOT IN('site','predio','sala') OR status_local<>'ativo' THEN
   RAISE EXCEPTION 'PPCI exige Site, Prédio ou Sala ativo' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER fire_safety_plans_local BEFORE INSERT OR UPDATE OF patrimonio_unidade_id,team_id ON app.fire_safety_plans FOR EACH ROW EXECUTE FUNCTION app.validar_local_ppci();

CREATE OR REPLACE FUNCTION app.validar_sistema_ppci() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE plano_local uuid; ativo_sala uuid;
BEGIN
 SELECT patrimonio_unidade_id INTO plano_local FROM app.fire_safety_plans WHERE tenant_id=NEW.tenant_id AND id=NEW.plan_id AND team_id=NEW.team_id;
 IF plano_local IS NULL THEN RAISE EXCEPTION 'Plano PPCI inválido' USING ERRCODE='23503'; END IF;
 IF NEW.ativo_id IS NOT NULL THEN
   SELECT sala_id INTO ativo_sala FROM app.patrimonial_assets WHERE tenant_id=NEW.tenant_id AND id=NEW.ativo_id AND team_id=NEW.team_id;
   IF ativo_sala IS NULL OR ativo_sala<>NEW.patrimonio_unidade_id THEN RAISE EXCEPTION 'Ativo não pertence ao local informado' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER fire_safety_systems_referencia BEFORE INSERT OR UPDATE ON app.fire_safety_systems FOR EACH ROW EXECUTE FUNCTION app.validar_sistema_ppci();
CREATE TRIGGER fire_safety_inspections_imutaveis BEFORE UPDATE OR DELETE ON app.fire_safety_inspections FOR EACH ROW EXECUTE FUNCTION app.impedir_alteracao_historico();

CREATE INDEX fire_safety_plans_due_idx ON app.fire_safety_plans(tenant_id,team_id,status,data_validade);
CREATE INDEX fire_safety_systems_plan_idx ON app.fire_safety_systems(tenant_id,team_id,plan_id,tipo);
CREATE INDEX fire_safety_inspections_plan_idx ON app.fire_safety_inspections(tenant_id,team_id,plan_id,data_inspecao DESC);

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['fire_safety_plans','fire_safety_systems','fire_safety_inspections'] LOOP
 EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY %I ON app.%I FOR ALL USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND team_id=nullif(current_setting(''app.team_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid AND team_id=nullif(current_setting(''app.team_id'',true),'''')::uuid)',t||'_isolation',t);
END LOOP; END $$;
GRANT SELECT,INSERT,UPDATE ON app.fire_safety_plans,app.fire_safety_systems TO prumo_api;
GRANT SELECT,INSERT ON app.fire_safety_inspections TO prumo_api;
