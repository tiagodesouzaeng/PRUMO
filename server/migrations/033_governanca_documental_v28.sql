ALTER TABLE app.documents
  ADD COLUMN versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
  ADD COLUMN aprovado_por text,
  ADD COLUMN aprovado_em timestamptz,
  ADD COLUMN arquivado_em timestamptz;

ALTER TABLE app.document_links
  ADD COLUMN principal boolean NOT NULL DEFAULT false,
  ADD COLUMN criado_por text NOT NULL DEFAULT 'migracao-033';

WITH primeiros AS (
  SELECT tenant_id, document_id, module_id, entidade_tipo, entidade_id,
         row_number() OVER (PARTITION BY tenant_id, document_id ORDER BY criado_em, module_id, entidade_tipo, entidade_id) AS ordem
    FROM app.document_links
)
UPDATE app.document_links dl SET principal = true
  FROM primeiros p
 WHERE p.tenant_id=dl.tenant_id AND p.document_id=dl.document_id
   AND p.module_id=dl.module_id AND p.entidade_tipo=dl.entidade_tipo AND p.entidade_id=dl.entidade_id
   AND p.ordem=1;

INSERT INTO app.document_links(tenant_id,document_id,module_id,entidade_tipo,entidade_id,principal,criado_por)
SELECT d.tenant_id,d.id,'documentos','acervo_legado',d.tenant_id::text,true,'migracao-033'
  FROM app.documents d
 WHERE NOT EXISTS (
   SELECT 1 FROM app.document_links dl WHERE dl.tenant_id=d.tenant_id AND dl.document_id=d.id
 );

CREATE UNIQUE INDEX document_links_principal_uq
  ON app.document_links(tenant_id,document_id) WHERE principal;
CREATE INDEX document_links_entidade_idx
  ON app.document_links(tenant_id,module_id,entidade_tipo,entidade_id,criado_em DESC);

CREATE OR REPLACE FUNCTION app.validar_documento_com_origem()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE alvo_tenant uuid; alvo_documento uuid;
BEGIN
  alvo_tenant := coalesce((to_jsonb(NEW)->>'tenant_id')::uuid,(to_jsonb(OLD)->>'tenant_id')::uuid);
  alvo_documento := coalesce(
    (to_jsonb(NEW)->>'document_id')::uuid,(to_jsonb(NEW)->>'id')::uuid,
    (to_jsonb(OLD)->>'document_id')::uuid,(to_jsonb(OLD)->>'id')::uuid
  );
  IF EXISTS (SELECT 1 FROM app.documents d WHERE d.tenant_id=alvo_tenant AND d.id=alvo_documento)
     AND NOT EXISTS (
       SELECT 1 FROM app.document_links dl
        WHERE dl.tenant_id=alvo_tenant AND dl.document_id=alvo_documento AND dl.principal
     ) THEN
    RAISE EXCEPTION 'documento precisa possuir uma entidade de origem' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER documents_origem_obrigatoria
AFTER INSERT OR UPDATE ON app.documents DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app.validar_documento_com_origem();
CREATE CONSTRAINT TRIGGER document_links_origem_obrigatoria
AFTER INSERT OR UPDATE OR DELETE ON app.document_links DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app.validar_documento_com_origem();

REVOKE ALL ON FUNCTION app.validar_documento_com_origem() FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON app.document_links TO prumo_api;

INSERT INTO app.module_catalog_versions(versao,status,descricao,criado_por)
VALUES(13,'publicada','Catálogo modular PRUMO 28.0 — governança documental','migracao-033');
