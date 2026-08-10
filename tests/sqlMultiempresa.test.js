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
const arquivoFechamento = new URL("../server/migrations/011_fechamento_sprint_10.sql", import.meta.url);
const arquivoPatrimonio = new URL("../server/migrations/012_cadastro_patrimonial_canonico.sql", import.meta.url);
const arquivoMovimentacaoPatrimonio = new URL("../server/migrations/013_endurecimento_movimentacao_patrimonial.sql", import.meta.url);
const arquivoLimpezaPatrimonio = new URL("../server/migrations/014_limpeza_tecnica_patrimonio.sql", import.meta.url);
const arquivoCompatibilidadeModular = new URL("../server/migrations/015_compatibilidade_ativacao_modular.sql", import.meta.url);
const arquivoDependenciasPadrao = new URL("../server/migrations/016_dependencias_modulares_padrao.sql", import.meta.url);
const arquivoPlanejamento = new URL("../server/migrations/018_demandas_carteira_investimentos.sql", import.meta.url);
const arquivoCompatibilidadePlanejamento = new URL("../server/migrations/019_compatibilidade_ativacao_planejamento.sql", import.meta.url);
const arquivoSuprimentos = new URL("../server/migrations/020_suprimentos_contratacoes.sql", import.meta.url);
const arquivoContratos = new URL("../server/migrations/021_contratos_gestao_contratual.sql", import.meta.url);

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

test("fechamento da Sprint 10 libera sincronização de integração no worker", async () => {
  const sql = await readFile(arquivoFechamento, "utf8");
  assert.match(sql, /integracao\.sincronizar/);
  assert.match(sql, /ALTER TABLE app\.jobs ADD CONSTRAINT jobs_tipo_check/);
});

test("Sprint 11 impõe a hierarquia patrimonial, RLS por equipe e histórico de movimentações", async () => {
  const sql = await readFile(arquivoPatrimonio, "utf8");
  assert.match(sql, /CREATE TABLE app\.patrimonial_units/);
  assert.match(sql, /nivel IN \('cliente', 'site', 'predio', 'sala'\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION app\.validar_hierarquia_patrimonial/);
  assert.match(sql, /CREATE TABLE app\.patrimonial_assets/);
  assert.match(sql, /CREATE TABLE app\.patrimonial_movements/);
  assert.match(sql, /patrimonial_units FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /team_id = nullif\(current_setting\('app\.team_id'/);
  assert.match(sql, /patrimonio_unidade_id/);
  assert.match(sql, /'obras', 'patrimonio'/);
});

test("movimentações patrimoniais são imutáveis e a sala não muda por edição comum", async () => {
  const sql = await readFile(arquivoMovimentacaoPatrimonio, "utf8");
  assert.match(sql, /patrimonial_movements_validar/);
  assert.match(sql, /patrimonial_assets_exigir_movimentacao/);
  assert.match(sql, /app\.patrimonial_movement/);
  assert.match(sql, /patrimonial_movements_imutaveis/);
  assert.match(sql, /REVOKE UPDATE, DELETE ON app\.patrimonial_movements/);
});

test("limpeza patrimonial de testes fica restrita ao migrador e a organizações técnicas", async () => {
  const sql = await readFile(arquivoLimpezaPatrimonio, "utf8");
  assert.match(sql, /nome LIKE 'Teste %'/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /REVOKE ALL ON FUNCTION app\.limpar_patrimonio_tenant_teste/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION app\.limpar_patrimonio_tenant_teste\(uuid\) TO prumo_migrator/);
});

test("ativação patrimonial preserva empresas que usam todos os módulos por padrão", async () => {
  const sql = await readFile(arquivoCompatibilidadeModular, "utf8");
  assert.match(sql, /total_modulos = 1/);
  assert.match(sql, /module_id = 'patrimonio'/);
  assert.match(sql, /DELETE FROM app\.tenant_modules/);
});

test("dependências modulares consideram contratos padrão de novas organizações", async () => {
  const sql = await readFile(arquivoDependenciasPadrao, "utf8");
  assert.match(sql, /LEFT JOIN app\.tenant_module_contracts dependente/);
  assert.match(sql, /coalesce\([\s\S]*dependente\.disponivel[\s\S]*true/);
  assert.match(sql, /o módulo possui dependentes obrigatórios habilitados/);
});

test("exclusão patrimonial é restrita às unidades e continua protegida por RLS", async () => {
  const sql = await readFile(new URL("../server/migrations/017_exclusao_unidade_patrimonial.sql", import.meta.url), "utf8");
  assert.match(sql, /GRANT DELETE ON app\.patrimonial_units TO prumo_api/);
  assert.doesNotMatch(sql, /GRANT DELETE ON app\.patrimonial_assets/);
  assert.doesNotMatch(sql, /GRANT DELETE ON app\.patrimonial_movements/);
});

test("Sprint 12 governa demandas, programas e carteiras com RLS e decisões imutáveis", async () => {
  const sql = await readFile(arquivoPlanejamento, "utf8");
  assert.match(sql, /CREATE TABLE app\.investment_programs/);
  assert.match(sql, /CREATE TABLE app\.investment_portfolios/);
  assert.match(sql, /CREATE TABLE app\.investment_demands/);
  assert.match(sql, /CREATE TABLE app\.investment_demand_decisions/);
  assert.match(sql, /investment_demands FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /investment_demand_decisions_imutaveis/);
  assert.match(sql, /VALUES \('planejamento', 'patrimonio', true\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION app\.limpar_planejamento_tenant_teste/);
  assert.doesNotMatch(sql, /GRANT[\s\S]*DELETE ON app\.investment_demands TO prumo_api/);
});

test("ativação de planejamento preserva organizações com catálogo implícito", async () => {
  const sql = await readFile(arquivoCompatibilidadePlanejamento, "utf8");
  assert.match(sql, /total_modulos = 1/);
  assert.match(sql, /module_id = 'planejamento'/);
  assert.match(sql, /DELETE FROM app\.tenant_modules/);
});

test("Sprint 13 governa fornecedores, contratações, pedidos e recebimentos com RLS", async () => {
  const sql = await readFile(arquivoSuprimentos, "utf8");
  assert.match(sql, /CREATE TABLE app\.suppliers/);
  assert.match(sql, /CREATE TABLE app\.procurement_processes/);
  assert.match(sql, /CREATE TABLE app\.procurement_quotes/);
  assert.match(sql, /CREATE TABLE app\.purchase_orders/);
  assert.match(sql, /CREATE TABLE app\.purchase_receipts/);
  assert.match(sql, /procurement_decisions_immutable/);
  assert.match(sql, /purchase_receipts_immutable/);
  assert.match(sql, /procurement_processes FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /somente demandas incorporadas originam contratação/);
  assert.match(sql, /'suprimentos', 'planejamento', true/);
  assert.doesNotMatch(sql, /GRANT[\s\S]*DELETE ON app\.purchase_receipts TO prumo_api/);
});

test("Sprint 14 governa contratos, saldos, fiscalização e encerramento com RLS", async () => {
  const sql = await readFile(arquivoContratos, "utf8");
  assert.match(sql, /CREATE TABLE app\.contracts/);
  assert.match(sql, /CREATE TABLE app\.contract_responsibles/);
  assert.match(sql, /CREATE TABLE app\.contract_amendments/);
  assert.match(sql, /CREATE TABLE app\.contract_guarantees/);
  assert.match(sql, /CREATE TABLE app\.contract_occurrences/);
  assert.match(sql, /CREATE TABLE app\.contract_sanctions/);
  assert.match(sql, /CREATE TABLE app\.contract_executions/);
  assert.match(sql, /contract_decisions_immutable/);
  assert.match(sql, /app\.contracts FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /somente processo aprovado origina contrato/);
  assert.match(sql, /'contratos','suprimentos',true/);
  assert.doesNotMatch(sql, /GRANT[\s\S]*DELETE ON app\.contract_decisions TO prumo_api/);
});
