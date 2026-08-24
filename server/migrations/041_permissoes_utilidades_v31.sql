-- Sprint 31 — permissões de operação de utilidades.
INSERT INTO app.permissions(id,module_id,descricao) VALUES
 ('utilidades.editar','utilidades','Cadastrar e administrar medidores'),
 ('utilidades.registrar-leitura','utilidades','Registrar leituras de utilidades')
ON CONFLICT DO NOTHING;

INSERT INTO app.default_profile_permissions(perfil_id,permission_id)
SELECT 'administrador',id FROM app.permissions WHERE module_id='utilidades'
ON CONFLICT DO NOTHING;
INSERT INTO app.default_profile_permissions(perfil_id,permission_id) VALUES
 ('gestor','utilidades.editar'),
 ('gestor','utilidades.registrar-leitura'),
 ('fiscal','utilidades.registrar-leitura')
ON CONFLICT DO NOTHING;
