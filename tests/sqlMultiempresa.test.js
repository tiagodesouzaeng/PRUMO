import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const arquivo = new URL("../server/migrations/001_multiempresa_orcamentos.sql", import.meta.url);
const arquivoMultimodulo = new URL("../server/migrations/002_nucleo_multimodulo.sql", import.meta.url);
const arquivoCatalogo = new URL(
  "../server/migrations/003_catalogo_e_migracao_assistida.sql",
  import.meta.url,
);
const arquivoFila = new URL(
  "../server/migrations/004_fila_e_transicao_repositorios.sql",
  import.meta.url,
);
const arquivoAuditoria = new URL(
  "../server/migrations/005_auditoria_governanca.sql",
  import.meta.url,
);
const arquivoAuditoriaOperacional = new URL(
  "../server/migrations/006_auditoria_operacional.sql",
  import.meta.url,
);
const arquivoAuditoriaLimpezaRls = new URL(
  "../server/migrations/007_auditoria_limpeza_teste_rls.sql",
  import.meta.url,
);
const arquivoDocumentos = new URL("../server/migrations/008_documentos_integracoes.sql", import.meta.url);
const arquivoProdutoModular = new URL("../server/migrations/009_produto_modular.sql", import.meta.url);
const arquivoEndurecimento = new URL("../server/migrations/010_endurecimento_ged_modular.sql", import.meta.url);

test("migração PostgreSQL força RLS e ativa contexto somente após validar vínculo", async () => {
  const sql = await readFile(arquivo, "utf8");
  assert.match(sql, /CREATE OR REPLACE FUNCTION app\.ativar_contexto/);
  assert.match(sql, /identity_subject = p_identity_subject/);
  assert.match(sql, /ALTER TABLE app\.orcamentos FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /current_setting\('app\.tenant_id'/);
  assert.match(sql, /current_setting\('app\.team_id'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION app\.ativar_contexto/);
});

test("migração mantém chaves de idempotência isoladas por empresa", async () => {
  const sql = await readFile(arquivo, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.idempotency_keys/);
  assert.match(sql, /PRIMARY KEY \(tenant_id, chave\)/);
  assert.match(sql, /CREATE POLICY idempotency_isolamento/);
});

test("núcleo multimódulo compartilha empreendimentos, permissões e eventos", async () => {
  const sql = await readFile(arquivoMultimodulo, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.modules/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.empreendimentos/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.domain_events/);
  assert.match(sql, /'obras', 'Obras e Contratos'/);
  assert.match(sql, /'manutencao', 'Manutenção'/);
  assert.match(sql, /'ppci', 'PPCI'/);
  assert.match(sql, /'suprimentos', 'Suprimentos e Aquisições'/);
});

test("revisões e medições usam RLS por empresa e equipe", async () => {
  const sql = await readFile(arquivoMultimodulo, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.orcamento_revisoes/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.medicoes/);
  assert.match(sql, /ALTER TABLE app\.orcamento_revisoes FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /ALTER TABLE app\.medicoes FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /valor_liquido numeric\(18,2\)[\s\S]*GENERATED ALWAYS/);
});

test("catálogo corporativo preserva publicações, preços por UF e memória analítica", async () => {
  const sql = await readFile(arquivoCatalogo, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.catalog_sources/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.catalog_publications/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.catalog_prices/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.catalog_composition_components/);
  assert.match(sql, /preco numeric\(18,6\)/);
  assert.match(sql, /coeficiente numeric\(24,12\)/);
  assert.match(sql, /status = 'homologada'/);
});

test("migração assistida usa área temporária, RLS e homologação rastreável", async () => {
  const sql = await readFile(arquivoCatalogo, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.migration_batches/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.migration_batch_records/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /migracao\.administrar/);
  assert.match(sql, /destino_tipo text/);
  assert.match(sql, /destino_id text/);
});

test("fila e transição dos repositórios são duráveis e isoladas por empresa", async () => {
  const sql = await readFile(arquivoFila, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.jobs/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.job_events/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.repository_transitions/);
  assert.match(sql, /ALTER TABLE app\.jobs FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /CREATE POLICY jobs_isolamento/);
  assert.match(sql, /modo IN \('local', 'hibrido', 'corporativo'\)/);
});

test("auditoria é imutável, encadeada e isolada por empresa", async () => {
  const sql = await readFile(arquivoAuditoria, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.audit_events/);
  assert.match(sql, /hash_anterior char\(64\)/);
  assert.match(sql, /CREATE TRIGGER audit_events_imutaveis/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON app\.audit_events/);
  assert.match(sql, /ALTER TABLE app\.audit_events FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS app\.audit_policies/);
  assert.match(sql, /auditoria\.administrar/);
});

test("limpeza técnica da auditoria não fica exposta à API", async () => {
  const sql = await readFile(arquivoAuditoriaOperacional, "utf8");
  const sqlRls = await readFile(arquivoAuditoriaLimpezaRls, "utf8");
  assert.match(sql, /nome LIKE 'Teste %'/);
  assert.match(sqlRls, /REVOKE ALL ON FUNCTION app\.limpar_auditoria_tenant_teste/);
  assert.match(sqlRls, /CREATE POLICY audit_events_limpeza_teste/);
  assert.match(sqlRls, /set_config\('app\.tenant_id'/);
});

test("GED e integrações preservam versões, hashes, referências seguras e RLS", async () => {
  const sql = await readFile(arquivoDocumentos, "utf8");
  assert.match(sql, /CREATE TABLE app\.documents/);
  assert.match(sql, /CREATE TABLE app\.document_versions/);
  assert.match(sql, /sha256 text NOT NULL/);
  assert.match(sql, /credential_reference text/);
  assert.match(sql, /ALTER TABLE app\.integration_runs FORCE ROW LEVEL SECURITY/);
});

test("produto modular distingue catálogo, capacidades, contratos e perfil organizacional", async () => {
  const sql = await readFile(arquivoProdutoModular, "utf8");
  assert.match(sql, /CREATE TABLE app\.module_catalog_versions/);
  assert.match(sql, /CREATE TABLE app\.module_capabilities/);
  assert.match(sql, /disponivel boolean/);
  assert.match(sql, /contratado boolean/);
  assert.match(sql, /habilitado boolean/);
  assert.match(sql, /'publico', 'federacao', 'privado', 'escritorio', 'facilities'/);
});

test("históricos do GED e integrações são imutáveis e dependências são protegidas", async () => {
  const sql = await readFile(arquivoEndurecimento, "utf8");
  assert.match(sql, /document_versions_imutaveis/);
  assert.match(sql, /integration_runs_imutaveis/);
  assert.match(sql, /REVOKE UPDATE, DELETE/);
  assert.match(sql, /tenant_module_contracts_dependencias/);
});
