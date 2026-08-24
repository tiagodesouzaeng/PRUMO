import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const ler=n=>readFile(new URL(`../server/migrations/${n}`,import.meta.url),"utf8");
test("Sprint 18 cria convênios, metas, repasses, execução e prestação com RLS",async()=>{const sql=await ler("026_convenios_prestacao_contas.sql");for(const trecho of ["app.agreements","app.agreement_goals","app.agreement_transfers","app.agreement_executions","app.agreement_accountabilities","ENABLE ROW LEVEL SECURITY","convenios.prestar-contas"])assert.match(sql,new RegExp(trecho.replaceAll(".","\\."),"i"));});
test("Sprint 19 governa regularidade, riscos, ações, auditorias e transparência",async()=>{const sql=await ler("027_regularidade_compliance_transparencia.sql");for(const trecho of ["app.compliance_requirements","app.compliance_risks","app.compliance_actions","app.compliance_audits","app.transparency_publications","transparencia.publicar"])assert.match(sql,new RegExp(trecho.replaceAll(".","\\."),"i"));});
test("Sprint 20 protege relatórios, portais, segredos e integrações por RLS",async()=>{const sql=await ler("028_bi_portais_consolidacao.sql");for(const trecho of ["app.report_definitions","app.portal_accesses","token_hash","app.integration_channels","segredo_referencia","ENABLE ROW LEVEL SECURITY"])assert.match(sql,new RegExp(trecho.replaceAll(".","\\."),"i"));});
