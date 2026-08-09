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

## Backup e restauração

A identidade da API não deve receber `BYPASSRLS` apenas para viabilizar cópias
do banco. Use uma credencial operacional dedicada em
`PRUMO_BACKUP_DATABASE_URL`, protegida fora do repositório, e valide a
restauração somente em um banco descartável. O procedimento completo está em
`docs/operacao/BACKUP_RESTAURACAO_POSTGRESQL.md`.
