CREATE OR REPLACE FUNCTION app.impedir_alteracao_historico()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'registros históricos são imutáveis' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER document_versions_imutaveis
BEFORE UPDATE OR DELETE ON app.document_versions
FOR EACH ROW EXECUTE FUNCTION app.impedir_alteracao_historico();

CREATE TRIGGER integration_runs_imutaveis
BEFORE UPDATE OR DELETE ON app.integration_runs
FOR EACH ROW EXECUTE FUNCTION app.impedir_alteracao_historico();

REVOKE UPDATE, DELETE ON app.document_versions, app.integration_runs FROM prumo_api;

CREATE OR REPLACE FUNCTION app.validar_contrato_modular()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.habilitado AND (NOT NEW.disponivel OR NOT NEW.contratado) THEN
    RAISE EXCEPTION 'módulo habilitado precisa estar disponível e contratado'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.habilitado AND EXISTS (
    SELECT 1
      FROM app.module_dependencies d
      LEFT JOIN app.tenant_module_contracts dependencia
        ON dependencia.tenant_id = NEW.tenant_id
       AND dependencia.module_id = d.depends_on_module_id
     WHERE d.module_id = NEW.module_id
       AND d.obrigatoria
       AND dependencia.module_id IS NOT NULL
       AND NOT (dependencia.disponivel AND dependencia.contratado AND dependencia.habilitado)
  ) THEN
    RAISE EXCEPTION 'dependência obrigatória do módulo não está habilitada'
      USING ERRCODE = '23514';
  END IF;

  IF NOT NEW.habilitado AND EXISTS (
    SELECT 1
      FROM app.module_dependencies d
      JOIN app.tenant_module_contracts dependente
        ON dependente.tenant_id = NEW.tenant_id
       AND dependente.module_id = d.module_id
     WHERE d.depends_on_module_id = NEW.module_id
       AND d.obrigatoria
       AND dependente.disponivel
       AND dependente.contratado
       AND dependente.habilitado
  ) THEN
    RAISE EXCEPTION 'o módulo possui dependentes obrigatórios habilitados'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenant_module_contracts_dependencias
BEFORE INSERT OR UPDATE ON app.tenant_module_contracts
FOR EACH ROW EXECUTE FUNCTION app.validar_contrato_modular();

REVOKE ALL ON FUNCTION app.impedir_alteracao_historico() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.validar_contrato_modular() FROM PUBLIC;

