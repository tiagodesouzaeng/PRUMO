-- Sprint 30 — descendência patrimonial, consistência das inspeções e limpeza técnica.
CREATE OR REPLACE FUNCTION app.validar_sistema_ppci() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE plano_local uuid; ativo_sala uuid; pertence boolean;
BEGIN
 SELECT patrimonio_unidade_id INTO plano_local FROM app.fire_safety_plans
  WHERE tenant_id=NEW.tenant_id AND id=NEW.plan_id AND team_id=NEW.team_id;
 IF plano_local IS NULL THEN RAISE EXCEPTION 'Plano PPCI inválido' USING ERRCODE='23503'; END IF;
 WITH RECURSIVE arvore AS (
   SELECT id,parent_id FROM app.patrimonial_units WHERE tenant_id=NEW.tenant_id AND id=NEW.patrimonio_unidade_id AND team_id=NEW.team_id
   UNION ALL SELECT p.id,p.parent_id FROM app.patrimonial_units p JOIN arvore a ON a.parent_id=p.id
    WHERE p.tenant_id=NEW.tenant_id AND p.team_id=NEW.team_id
 ) SELECT EXISTS(SELECT 1 FROM arvore WHERE id=plano_local) INTO pertence;
 IF NOT pertence THEN RAISE EXCEPTION 'Local do sistema não pertence ao escopo patrimonial do PPCI' USING ERRCODE='23514'; END IF;
 IF NEW.ativo_id IS NOT NULL THEN
   SELECT sala_id INTO ativo_sala FROM app.patrimonial_assets WHERE tenant_id=NEW.tenant_id AND id=NEW.ativo_id AND team_id=NEW.team_id;
   IF ativo_sala IS NULL OR ativo_sala<>NEW.patrimonio_unidade_id THEN RAISE EXCEPTION 'Ativo não pertence ao local informado' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION app.validar_inspecao_ppci() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.system_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM app.fire_safety_systems s WHERE s.tenant_id=NEW.tenant_id AND s.id=NEW.system_id AND s.team_id=NEW.team_id AND s.plan_id=NEW.plan_id
 ) THEN RAISE EXCEPTION 'Sistema não pertence ao PPCI informado' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER fire_safety_inspections_referencia BEFORE INSERT ON app.fire_safety_inspections FOR EACH ROW EXECUTE FUNCTION app.validar_inspecao_ppci();

CREATE OR REPLACE FUNCTION app.limpar_ppci_tenant_teste(p_tenant_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=app,pg_temp AS $$
DECLARE equipe record; total integer:=0; parcial integer:=0;
BEGIN
 IF NOT pg_has_role(session_user,'prumo_migrator','member') THEN
   RAISE EXCEPTION 'limpeza PPCI restrita à identidade de migração' USING ERRCODE='42501';
 END IF;
 PERFORM set_config('app.tenant_id',p_tenant_id::text,true);
 PERFORM set_config('app.limpeza_documental_teste','permitida',true);
 FOR equipe IN SELECT id FROM app.teams WHERE tenant_id=p_tenant_id LOOP
   PERFORM set_config('app.team_id',equipe.id::text,true);
   DELETE FROM app.fire_safety_inspections WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; total:=total+parcial;
   DELETE FROM app.fire_safety_systems WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; total:=total+parcial;
   DELETE FROM app.fire_safety_plans WHERE tenant_id=p_tenant_id; GET DIAGNOSTICS parcial=ROW_COUNT; total:=total+parcial;
 END LOOP;
 RETURN total;
END; $$;
REVOKE ALL ON FUNCTION app.validar_local_ppci() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.validar_sistema_ppci() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.validar_inspecao_ppci() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.limpar_ppci_tenant_teste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.limpar_ppci_tenant_teste(uuid) TO prumo_migrator;
