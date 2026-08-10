ALTER TABLE app.jobs DROP CONSTRAINT IF EXISTS jobs_tipo_check;
ALTER TABLE app.jobs ADD CONSTRAINT jobs_tipo_check
  CHECK (tipo IN (
    'sistema.diagnostico',
    'catalogo.importar',
    'orcamento.recalcular',
    'integracao.sincronizar'
  ));
