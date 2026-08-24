# Migrações PostgreSQL do PRUMO

As migrações devem ser executadas por uma identidade proprietária separada da
identidade usada pela API.

## Princípios

- a role da API não pode possuir `BYPASSRLS`;
- a role da API não deve ser proprietária das tabelas;
- `FORCE ROW LEVEL SECURITY` deve permanecer habilitado;
- a API só configura `app.tenant_id` chamando `app.ativar_contexto`;
- a função valida o vínculo do `subject` autenticado antes de ativar a empresa;
- o cabeçalho enviado pelo navegador não concede acesso por conta própria.

## Autorizações mínimas da role de execução

O administrador do banco deve adaptar os nomes das roles ao ambiente e conceder
somente:

```sql
ALTER ROLE prumo_api NOBYPASSRLS;
GRANT USAGE ON SCHEMA app TO prumo_api;
GRANT EXECUTE ON FUNCTION app.ativar_contexto(uuid, text, uuid) TO prumo_api;
GRANT SELECT, INSERT, UPDATE ON app.orcamentos TO prumo_api;
GRANT SELECT, INSERT, DELETE ON app.idempotency_keys TO prumo_api;
GRANT SELECT ON app.modules, app.permissions,
  app.default_profile_permissions, app.tenant_modules,
  app.tenant_profile_permissions TO prumo_api;
GRANT SELECT, INSERT, UPDATE ON app.empreendimentos TO prumo_api;
GRANT SELECT, INSERT ON app.orcamento_revisoes, app.medicoes TO prumo_api;
GRANT INSERT ON app.domain_events TO prumo_api;
GRANT SELECT, INSERT, UPDATE ON
  app.catalog_sources, app.catalog_publications TO prumo_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  app.catalog_items, app.catalog_prices,
  app.catalog_composition_components,
  app.own_compositions, app.own_composition_components,
  app.tenant_settings,
  app.migration_batches, app.migration_batch_records TO prumo_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  app.jobs, app.job_events, app.repository_transitions TO prumo_api;
GRANT SELECT, INSERT ON app.audit_events TO prumo_api;
GRANT SELECT, INSERT, UPDATE ON app.audit_policies TO prumo_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  app.documents, app.document_links, app.integrations TO prumo_api;
GRANT SELECT, INSERT ON app.document_versions, app.integration_runs TO prumo_api;
GRANT SELECT ON app.module_catalog_versions, app.module_capabilities,
  app.module_dependencies TO prumo_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  app.tenant_product_profiles, app.tenant_module_contracts TO prumo_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO prumo_api;
```

Tenants, equipes e vínculos devem ser administrados por rotinas específicas,
não pelas rotas comuns de orçamento.

O esquema `app` representa o núcleo corporativo compartilhado por todos os
módulos. As próximas migrações de Obras, Manutenção, PPCI, Suprimentos,
Medições e GED devem reutilizar tenants, equipes, vínculos e a mesma estratégia
de RLS, sem criar cadastros corporativos paralelos.

## Aplicação

Configure `PRUMO_DATABASE_URL` com a identidade limitada da API e
`PRUMO_MIGRATION_DATABASE_URL` com a identidade proprietária das tabelas.
O executor de migrações prioriza a segunda variável e mantém compatibilidade
com ambientes antigos que possuem apenas `PRUMO_DATABASE_URL`.

```bash
pnpm db:migrate
```

O executor mantém checksum e recusa alterações em migrações já aplicadas.

A migração `029_prontidao_piloto_v25.sql` adiciona as permissões administrativas
do piloto. O estado e as evidências ficam em `app.tenant_settings`, sob a mesma
RLS da organização, e as decisões relevantes são registradas na Auditoria.

O marco `030_acesso_e_consolidacao_modular_v26.sql` incorpora PPCI em
Regularidade, bases de preços em Orçamentos/Administração, renomeia Solicitações
e amplia Utilidades. Os identificadores legados permanecem inativos para não
romper dados históricos.

As migrações `031` e `032` implantam o ciclo contratado da Sprint 27: base
homologada imutável, solicitações de aditivo, decisões da engenharia de custos,
RLS, permissões segregadas e limpeza restrita às organizações de integração.

As migrações `033` e `034` implantam a governança documental da Sprint 28:
origem obrigatória, vínculo principal único, fluxo versionado de aprovação,
índices por entidade e limpeza de integração restrita ao migrador.

As migrações `035` e `036` implantam a promoção verificável da Sprint 29:
manifestos de paridade imutáveis, barreira de 24 horas para ativação corporativa,
retorno justificado, concorrência otimista e limpeza de integração compatível
com o isolamento por equipe.

As migrações `037` e `038` implantam o PPCI local da Sprint 30: processos,
sistemas e inspeções sob RLS; vínculo obrigatório a Site, Prédio ou Sala;
descendência patrimonial dos sistemas; ativos restritos à Sala; inspeções
imutáveis e limpeza técnica disponível somente ao migrador.

As migrações `039` a `042` concluem a Sprint 31: edição e remoção rastreável
dos sistemas PPCI, medidores e leituras de utilidades sob RLS, permissões
segregadas, catálogo seguro de responsáveis do cliente ativo e limpeza de
integração restrita ao migrador.

## Backup e restauração

A identidade da API não deve receber `BYPASSRLS` apenas para viabilizar cópias
do banco. Use uma credencial operacional dedicada em
`PRUMO_BACKUP_DATABASE_URL`, protegida fora do repositório, e valide a
restauração somente em um banco descartável. O procedimento completo está em
`docs/operacao/BACKUP_RESTAURACAO_POSTGRESQL.md`.
