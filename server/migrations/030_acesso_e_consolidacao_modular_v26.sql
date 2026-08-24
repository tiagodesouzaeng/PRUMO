-- Sprint 26/26.1: consolidação da navegação e das responsabilidades dos módulos.
UPDATE app.modules SET nome='Solicitações e Investimentos',ordem=18 WHERE id='planejamento';
UPDATE app.modules SET nome='Orçamentos e Bases de Preços',ordem=30 WHERE id='orcamentos';
UPDATE app.modules SET nome='Regularidade e Segurança Predial',ordem=82 WHERE id='regularidade';
UPDATE app.modules SET nome='Utilidades, Energia e Consumos',ordem=90 WHERE id='utilidades';

UPDATE app.permissions SET module_id='orcamentos',descricao='Consultar bases de preços nos orçamentos' WHERE id='bases.consultar';
UPDATE app.permissions SET module_id='administracao',descricao='Administrar e publicar bases de preços' WHERE id='bases.administrar';
UPDATE app.permissions SET module_id='regularidade',descricao='Consultar PPCI em Regularidade' WHERE id='ppci.consultar';
UPDATE app.permissions SET module_id='regularidade',descricao='Editar PPCI em Regularidade' WHERE id='ppci.editar';

UPDATE app.modules SET status='inativo' WHERE id IN('bases-precos','ppci');
UPDATE app.tenant_modules SET status='inativo' WHERE module_id IN('bases-precos','ppci');
DELETE FROM app.module_dependencies WHERE module_id IN('bases-precos','ppci') OR depends_on_module_id IN('bases-precos','ppci');

INSERT INTO app.module_capabilities(module_id,capability_id,nome,versao_catalogo) VALUES
 ('regularidade','ppci-integrado','PPCI integrado à regularidade e segurança predial',1),
 ('orcamentos','bases-integradas','Bases oficiais, comerciais e próprias integradas aos orçamentos',1),
 ('utilidades','multirrecurso','Água, energia, geração, créditos, débitos, gás e demais consumos',1),
 ('planejamento','solicitacoes-investimentos','Solicitações e investimentos com contexto patrimonial',1),
 ('administracao','publicacao-central-bases','Publicação central e auditável das bases de preços',1)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE app.memberships IS
  'Vínculos de identidade corporativa ou de contingência; senhas nunca são armazenadas nesta tabela.';
