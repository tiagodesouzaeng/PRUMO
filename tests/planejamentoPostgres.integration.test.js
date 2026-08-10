import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { criarRepositorioPostgres } from "../server/db/postgresRepository.js";

const { Client } = pg;
const apiUrl = process.env.PRUMO_DATABASE_URL || "";
const migrationUrl = process.env.PRUMO_MIGRATION_DATABASE_URL || "";

test("PostgreSQL isola e governa demandas até a carteira", {
  skip: !(apiUrl && migrationUrl) && "Conexões PostgreSQL de integração não configuradas.",
}, async () => {
  const sufixo = randomUUID().slice(0, 8); const tenantId = randomUUID(); const teamA = randomUUID(); const teamB = randomUUID(); const subject = `teste-planejamento-${sufixo}`;
  const admin = new Client({ connectionString: migrationUrl }); const repository = criarRepositorioPostgres({ connectionString: apiUrl });
  const contextoA = { identity: { subject }, tenantId, teamId: teamA }; const contextoB = { identity: { subject }, tenantId, teamId: teamB };
  try {
    await admin.connect();
    await admin.query("INSERT INTO app.tenants (id,nome) VALUES ($1,'Teste Planejamento')", [tenantId]);
    await admin.query("INSERT INTO app.teams (tenant_id,id,nome) VALUES ($1,$2,'Equipe A'),($1,$3,'Equipe B')", [tenantId,teamA,teamB]);
    await admin.query("INSERT INTO app.memberships (tenant_id,identity_subject,perfil_id) VALUES ($1,$2,'administrador')", [tenantId,subject]);
    await admin.query("INSERT INTO app.team_memberships (tenant_id,team_id,identity_subject) VALUES ($1,$2,$4),($1,$3,$4)", [tenantId,teamA,teamB,subject]);
    const unidade = await repository.criarUnidadePatrimonial(contextoA,{nivel:"cliente",codigo:`C-${sufixo}`,nome:"Cliente"},`u-${sufixo}`);
    const programa = await repository.criarProgramaInvestimento(contextoA,{codigo:`PRG-${sufixo}`,nome:"Programa",limiteFinanceiro:900000},`p-${sufixo}`);
    const carteira = await repository.criarCarteiraInvestimento(contextoA,{codigo:`CAR-${sufixo}`,nome:"Plano anual",ano:2026,limiteFinanceiro:300000},`c-${sufixo}`);
    let demanda = await repository.criarDemandaInvestimento(contextoA,{patrimonioUnidadeId:unidade.id,programaId:programa.id,codigo:`D-${sufixo}`,titulo:"Demanda de teste",valorEstimado:200000,urgencia:5,impacto:4,risco:3,alinhamento:5},`d-${sufixo}`);
    assert.equal((await repository.listarDemandasInvestimento(contextoB)).length,0);
    for (const acao of ["enviar_analise","priorizar","aprovar"]) demanda=(await repository.decidirDemandaInvestimento(contextoA,demanda.id,{acao,justificativa:"Teste integrado"},demanda.versao,`${acao}-${sufixo}`)).demanda;
    const incorporada = await repository.incorporarDemandaCarteira(contextoA,carteira.id,{demandId:demanda.id,ordem:1,valorPlanejado:190000,observacao:"Aprovada"},demanda.versao,`i-${sufixo}`);
    assert.equal(incorporada.demanda.status,"incorporada"); assert.equal((await repository.listarCarteirasInvestimento(contextoA))[0].itens.length,1);
    const decisoes = await repository.listarDecisoesDemanda(contextoA,demanda.id); assert.equal(decisoes.length,4);
    await assert.rejects(() => repository.atualizarDemandaInvestimento(contextoA,demanda.id,{...demanda,titulo:"Alteração indevida"},incorporada.demanda.versao),(error)=>error.code === "DEMANDA_NAO_EDITAVEL");
  } finally {
    await repository.fechar();
    if (admin._connected) {
      await admin.query("SELECT app.limpar_planejamento_tenant_teste($1)",[tenantId]);
      await admin.query("SELECT app.limpar_patrimonio_tenant_teste($1)",[tenantId]);
      await admin.query("BEGIN"); await admin.query("SELECT app.ativar_contexto($1,$2,$3)",[tenantId,subject,teamA]);
      await admin.query("DELETE FROM app.domain_events"); await admin.query("DELETE FROM app.idempotency_keys"); await admin.query("COMMIT");
      await admin.query("SELECT app.limpar_auditoria_tenant_teste($1)",[tenantId]);
      await admin.query("DELETE FROM app.team_memberships WHERE tenant_id=$1",[tenantId]); await admin.query("DELETE FROM app.memberships WHERE tenant_id=$1",[tenantId]); await admin.query("DELETE FROM app.teams WHERE tenant_id=$1",[tenantId]); await admin.query("DELETE FROM app.tenants WHERE id=$1",[tenantId]); await admin.end();
    }
  }
});
