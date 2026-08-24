import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { criarRepositorioPostgres } from "../server/db/postgresRepository.js";

const {Client}=pg;const apiUrl=process.env.PRUMO_DATABASE_URL||"";const migrationUrl=process.env.PRUMO_MIGRATION_DATABASE_URL||"";
test("PostgreSQL governa origem, aprovação e isolamento documental",{skip:!(apiUrl&&migrationUrl)&&"Conexões PostgreSQL não configuradas."},async()=>{
  const sufixo=randomUUID().slice(0,8),tenantId=randomUUID(),teamA=randomUUID(),teamB=randomUUID(),subject=`teste-doc-${sufixo}`;
  const admin=new Client({connectionString:migrationUrl});const repository=criarRepositorioPostgres({connectionString:apiUrl});
  const contextoA={identity:{subject},tenantId,teamId:teamA},contextoB={identity:{subject},tenantId,teamId:teamB};
  try{
    await admin.connect();
    await admin.query("INSERT INTO app.tenants(id,nome) VALUES($1,'Teste documental')",[tenantId]);
    await admin.query("INSERT INTO app.teams(tenant_id,id,nome) VALUES($1,$2,'Equipe A'),($1,$3,'Equipe B')",[tenantId,teamA,teamB]);
    await admin.query("INSERT INTO app.memberships(tenant_id,identity_subject,perfil_id) VALUES($1,$2,'administrador')",[tenantId,subject]);
    await admin.query("INSERT INTO app.team_memberships(tenant_id,team_id,identity_subject) VALUES($1,$2,$4),($1,$3,$4)",[tenantId,teamA,teamB,subject]);
    const orcamento=await repository.criarOrcamento(contextoA,{nome:"Orçamento documental",dados:{}},`orc-${sufixo}`);
    const documento=await repository.criarDocumento(contextoA,{titulo:"Memorial descritivo",vinculo:{moduleId:"orcamentos",entidadeTipo:"orcamento",entidadeId:orcamento.id}},`doc-${sufixo}`);
    assert.equal(documento.vinculos[0].principal,true);
    assert.equal((await repository.listarEntidadesDocumentais(contextoA)).some((e)=>e.id===orcamento.id),true);
    assert.equal((await repository.listarDocumentos(contextoB)).length,0);
    await assert.rejects(()=>repository.criarDocumento(contextoB,{titulo:"Cópia indevida",vinculo:{moduleId:"orcamentos",entidadeTipo:"orcamento",entidadeId:orcamento.id}},`cross-${sufixo}`),(e)=>e.code==="ENTIDADE_DOCUMENTAL_NAO_ENCONTRADA");
    const versionado=await repository.adicionarVersaoDocumento(contextoA,documento.id,{nomeArquivo:"memorial.pdf",sha256:"b".repeat(64),storageKey:`${tenantId}/documentos/${documento.id}/memorial.pdf`});
    assert.equal(versionado.versaoAtual,1);
    const submetido=await repository.decidirDocumento(contextoA,documento.id,{acao:"submeter"},documento.versao);
    const aprovado=await repository.decidirDocumento(contextoA,documento.id,{acao:"aprovar"},submetido.versao);
    assert.equal(aprovado.status,"aprovado");assert.equal(Boolean(aprovado.aprovadoPor),true);
  }finally{
    await repository.fechar();
    if(admin._connected){
      await admin.query("BEGIN");await admin.query("SELECT app.ativar_contexto($1,$2,$3)",[tenantId,subject,teamA]);
      await admin.query("SELECT app.limpar_documentos_tenant_teste($1)",[tenantId]);await admin.query("DELETE FROM app.orcamentos WHERE tenant_id=$1",[tenantId]);
      await admin.query("DELETE FROM app.domain_events WHERE tenant_id=$1",[tenantId]);await admin.query("DELETE FROM app.idempotency_keys WHERE tenant_id=$1",[tenantId]);await admin.query("COMMIT");
      await admin.query("SELECT app.limpar_auditoria_tenant_teste($1)",[tenantId]);await admin.query("DELETE FROM app.team_memberships WHERE tenant_id=$1",[tenantId]);await admin.query("DELETE FROM app.memberships WHERE tenant_id=$1",[tenantId]);await admin.query("DELETE FROM app.teams WHERE tenant_id=$1",[tenantId]);await admin.query("DELETE FROM app.tenants WHERE id=$1",[tenantId]);await admin.end();
    }
  }
});
