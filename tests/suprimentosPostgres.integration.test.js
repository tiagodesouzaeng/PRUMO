import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { criarRepositorioPostgres } from "../server/db/postgresRepository.js";

const { Client } = pg;
const apiUrl = process.env.PRUMO_DATABASE_URL || "";
const migrationUrl = process.env.PRUMO_MIGRATION_DATABASE_URL || "";

test("PostgreSQL isola e governa o ciclo de suprimentos até o recebimento", {
  skip: !(apiUrl && migrationUrl) && "Conexões PostgreSQL de integração não configuradas.",
}, async () => {
  const sufixo = randomUUID().slice(0, 8); const tenantId = randomUUID(); const teamA = randomUUID(); const teamB = randomUUID(); const subject = `teste-suprimentos-${sufixo}`;
  const admin = new Client({ connectionString: migrationUrl }); const repository = criarRepositorioPostgres({ connectionString: apiUrl });
  const contextoA = { identity: { subject }, tenantId, teamId: teamA }; const contextoB = { identity: { subject }, tenantId, teamId: teamB };
  try {
    await admin.connect();
    await admin.query("INSERT INTO app.tenants (id,nome) VALUES ($1,'Teste Suprimentos')", [tenantId]);
    await admin.query("INSERT INTO app.teams (tenant_id,id,nome) VALUES ($1,$2,'Equipe A'),($1,$3,'Equipe B')", [tenantId,teamA,teamB]);
    await admin.query("INSERT INTO app.memberships (tenant_id,identity_subject,perfil_id) VALUES ($1,$2,'administrador')", [tenantId,subject]);
    await admin.query("INSERT INTO app.team_memberships (tenant_id,team_id,identity_subject) VALUES ($1,$2,$4),($1,$3,$4)", [tenantId,teamA,teamB,subject]);
    const unidade = await repository.criarUnidadePatrimonial(contextoA,{nivel:"cliente",codigo:`C-${sufixo}`,nome:"Cliente"},`u-${sufixo}`);
    const carteira = await repository.criarCarteiraInvestimento(contextoA,{codigo:`CAR-${sufixo}`,nome:"Plano anual",ano:2026,limiteFinanceiro:500000},`c-${sufixo}`);
    let demanda = await repository.criarDemandaInvestimento(contextoA,{patrimonioUnidadeId:unidade.id,codigo:`D-${sufixo}`,titulo:"Aquisição integrada",valorEstimado:180000},`d-${sufixo}`);
    for (const acao of ["enviar_analise","priorizar","aprovar"]) demanda=(await repository.decidirDemandaInvestimento(contextoA,demanda.id,{acao,justificativa:"Teste integrado"},demanda.versao,`${acao}-${sufixo}`)).demanda;
    demanda=(await repository.incorporarDemandaCarteira(contextoA,carteira.id,{demandId:demanda.id,ordem:1,valorPlanejado:175000},demanda.versao,`inc-${sufixo}`)).demanda;
    const fornecedor=await repository.criarFornecedor(contextoA,{codigo:`F-${sufixo}`,razaoSocial:"Fornecedor integrado",documento:`DOC-${sufixo}`,qualificacao:"qualificado"},`f-${sufixo}`);
    let processo=await repository.criarProcessoContratacao(contextoA,{demandId:demanda.id,codigo:`PC-${sufixo}`,titulo:"Processo integrado",objeto:"Fornecimento de materiais",tipo:"material",regime:"publico",valorEstimado:175000},`pc-${sufixo}`);
    assert.equal((await repository.listarProcessosContratacao(contextoB)).length,0);
    for(const acao of ["iniciar_planejamento","abrir_pesquisa"]) processo=(await repository.decidirProcessoContratacao(contextoA,processo.id,{acao,dados:{}},processo.versao,`${acao}-${sufixo}`)).processo;
    const cotacao=await repository.registrarCotacao(contextoA,processo.id,{supplierId:fornecedor.id,valorTotal:168000,prazoEntregaDias:15},`cot-${sufixo}`);
    for(const acao of ["iniciar_selecao","aprovar"]) processo=(await repository.decidirProcessoContratacao(contextoA,processo.id,{acao,dados:{}},processo.versao,`${acao}-${sufixo}`)).processo;
    const emissao=await repository.emitirPedidoCompra(contextoA,processo.id,{supplierId:fornecedor.id,quoteId:cotacao.id,codigo:`PED-${sufixo}`,valorTotal:168000},processo.versao,`ped-${sufixo}`);
    const recebimento=await repository.registrarRecebimentoPedido(contextoA,emissao.pedido.id,{valorRecebido:168000,aceite:"aceito"},`rec-${sufixo}`);
    assert.equal(recebimento.pedido.status,"recebido"); assert.equal(recebimento.processo.status,"concluida");
    const detalhe=await repository.obterProcessoContratacao(contextoA,processo.id); assert.equal(detalhe.cotacoes[0].status,"vencedora"); assert.equal(detalhe.decisoes.length,6);
  } finally {
    await repository.fechar();
    if (admin._connected) {
      await admin.query("SELECT app.limpar_suprimentos_tenant_teste($1)",[tenantId]);
      await admin.query("SELECT app.limpar_planejamento_tenant_teste($1)",[tenantId]);
      await admin.query("SELECT app.limpar_patrimonio_tenant_teste($1)",[tenantId]);
      await admin.query("BEGIN"); await admin.query("SELECT app.ativar_contexto($1,$2,$3)",[tenantId,subject,teamA]);
      await admin.query("DELETE FROM app.domain_events"); await admin.query("DELETE FROM app.idempotency_keys"); await admin.query("COMMIT");
      await admin.query("SELECT app.limpar_auditoria_tenant_teste($1)",[tenantId]);
      await admin.query("DELETE FROM app.team_memberships WHERE tenant_id=$1",[tenantId]); await admin.query("DELETE FROM app.memberships WHERE tenant_id=$1",[tenantId]); await admin.query("DELETE FROM app.teams WHERE tenant_id=$1",[tenantId]); await admin.query("DELETE FROM app.tenants WHERE id=$1",[tenantId]); await admin.end();
    }
  }
});
