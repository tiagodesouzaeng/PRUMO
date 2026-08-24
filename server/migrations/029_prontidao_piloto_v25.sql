INSERT INTO app.permissions(id,module_id,descricao) VALUES
  ('piloto.consultar','administracao','Consultar prontidão e execução do piloto'),
  ('piloto.administrar','administracao','Administrar evidências e decisões do piloto')
ON CONFLICT(id) DO UPDATE SET module_id=EXCLUDED.module_id,descricao=EXCLUDED.descricao;

INSERT INTO app.default_profile_permissions(perfil_id,permission_id)
SELECT 'administrador',id FROM app.permissions
WHERE id IN('piloto.consultar','piloto.administrar')
ON CONFLICT DO NOTHING;

INSERT INTO app.default_profile_permissions(perfil_id,permission_id)
VALUES ('gestor','piloto.consultar'),('aprovador','piloto.consultar')
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN app.tenant_settings.valor IS
  'Configurações por organização; a chave operacao.piloto.v25 armazena o checklist e as decisões auditáveis do piloto.';
