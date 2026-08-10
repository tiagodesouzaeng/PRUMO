-- Permite à API excluir uma unidade patrimonial somente sob o contexto RLS
-- já validado. Ativos e movimentações continuam sem exclusão pela API.
GRANT DELETE ON app.patrimonial_units TO prumo_api;

COMMENT ON TABLE app.patrimonial_units IS
  'Hierarquia Cliente, Site, Prédio e Sala; exclusão condicionada à ausência de vínculos e registrada em auditoria.';
