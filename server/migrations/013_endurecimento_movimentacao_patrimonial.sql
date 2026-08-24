CREATE OR REPLACE FUNCTION app.validar_movimentacao_patrimonial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sala_atual uuid;
  nivel_origem text;
  nivel_destino text;
  status_destino text;
BEGIN
  SELECT sala_id INTO sala_atual
    FROM app.patrimonial_assets
   WHERE tenant_id = NEW.tenant_id AND id = NEW.asset_id AND team_id = NEW.team_id;
  SELECT nivel INTO nivel_origem
    FROM app.patrimonial_units
   WHERE tenant_id = NEW.tenant_id AND id = NEW.origem_sala_id AND team_id = NEW.team_id;
  SELECT nivel, status INTO nivel_destino, status_destino
    FROM app.patrimonial_units
   WHERE tenant_id = NEW.tenant_id AND id = NEW.destino_sala_id AND team_id = NEW.team_id;

  IF sala_atual IS DISTINCT FROM NEW.origem_sala_id THEN
    RAISE EXCEPTION 'A origem não corresponde à localização atual do ativo' USING ERRCODE = '23514';
  END IF;
  IF nivel_origem IS DISTINCT FROM 'sala' OR nivel_destino IS DISTINCT FROM 'sala' THEN
    RAISE EXCEPTION 'A movimentação deve ocorrer entre salas' USING ERRCODE = '23514';
  END IF;
  IF status_destino <> 'ativo' THEN
    RAISE EXCEPTION 'A sala de destino precisa estar ativa' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER patrimonial_movements_validar
BEFORE INSERT ON app.patrimonial_movements
FOR EACH ROW EXECUTE FUNCTION app.validar_movimentacao_patrimonial();

CREATE OR REPLACE FUNCTION app.exigir_movimentacao_para_trocar_sala()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sala_id IS DISTINCT FROM OLD.sala_id
     AND current_setting('app.patrimonial_movement', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'A troca de sala exige uma movimentação patrimonial' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER patrimonial_assets_exigir_movimentacao
BEFORE UPDATE OF sala_id ON app.patrimonial_assets
FOR EACH ROW EXECUTE FUNCTION app.exigir_movimentacao_para_trocar_sala();

CREATE TRIGGER patrimonial_movements_imutaveis
BEFORE UPDATE OR DELETE ON app.patrimonial_movements
FOR EACH ROW EXECUTE FUNCTION app.impedir_alteracao_historico();

REVOKE UPDATE, DELETE ON app.patrimonial_movements FROM prumo_api;
REVOKE ALL ON FUNCTION app.validar_movimentacao_patrimonial() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.exigir_movimentacao_para_trocar_sala() FROM PUBLIC;
