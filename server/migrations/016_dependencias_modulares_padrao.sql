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
       AND NOT coalesce(
         dependencia.disponivel AND dependencia.contratado AND dependencia.habilitado,
         true
       )
  ) THEN
    RAISE EXCEPTION 'dependência obrigatória do módulo não está habilitada'
      USING ERRCODE = '23514';
  END IF;

  IF NOT NEW.habilitado AND EXISTS (
    SELECT 1
      FROM app.module_dependencies d
      LEFT JOIN app.tenant_module_contracts dependente
        ON dependente.tenant_id = NEW.tenant_id
       AND dependente.module_id = d.module_id
     WHERE d.depends_on_module_id = NEW.module_id
       AND d.obrigatoria
       AND coalesce(
         dependente.disponivel AND dependente.contratado AND dependente.habilitado,
         true
       )
  ) THEN
    RAISE EXCEPTION 'o módulo possui dependentes obrigatórios habilitados'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.validar_contrato_modular() FROM PUBLIC;
