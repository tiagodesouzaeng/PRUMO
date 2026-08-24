import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { avaliarSla, calcularCustoOrdem, calcularVencimentoSla, resolverTransicaoChamado } from "../server/domain/maintenance.js";

const headers=(chave="",versao="")=>({"x-prumo-tenant-id":"EMP-1","x-prumo-team-id":"EQ-1",...(chave?{"idempotency-key":chave}:{}),...(versao!==""?{"if-match":String(versao)}:{})});
async function criarApi(){return criarAplicacaoApi({repository:criarRepositorioMemoria({tenants:[{id:"EMP-1",nome:"Federação",status:"ativo"}],memberships:[{tenantId:"EMP-1",subject:"ADMIN",perfilId:"administrador",teamIds:["EQ-1"],status:"ativo"}],unidadesPatrimoniais:[{id:"SALA-1",tenantId:"EMP-1",teamId:"EQ-1",nivel:"sala",codigo:"SL-01",nome:"Casa de máquinas",status:"ativo",versao:1}],ativosPatrimoniais:[{id:"AT-1",tenantId:"EMP-1",teamId:"EQ-1",salaId:"SALA-1",codigo:"AT-001",nome:"Bomba",status:"ativo",versao:1}]}),authenticate:async()=>({subject:"ADMIN"})});}

test("domínio de facilities calcula SLA, transições e custos",()=>{
  assert.equal(calcularVencimentoSla("critica","2026-08-11T10:00:00.000Z"),"2026-08-11T14:00:00.000Z");
  assert.equal(avaliarSla({status:"aberto",slaVencimento:"2026-08-11T12:00:00.000Z"},new Date("2026-08-11T13:00:00.000Z")),"violado");
  assert.equal(resolverTransicaoChamado("em_atendimento","resolver").para,"resolvido");
  assert.equal(calcularCustoOrdem([{quantidade:2,valorUnitario:10.239},{quantidade:1,valorUnitario:5}]),25.47);
});
test("API executa plano, chamado, ordem, custo, solução e aceite",async(t)=>{
  const app=await criarApi();t.after(()=>app.close());
  const plano=await app.inject({method:"POST",url:"/v1/manutencao/planos",headers:headers("PLANO-1"),payload:{ativoId:"AT-1",codigo:"PM-001",nome:"Revisão mensal da bomba",especialidade:"hidraulica",periodicidadeDias:30,proximaExecucao:"2026-09-01",responsavel:"Facilities",dados:{}}});assert.equal(plano.statusCode,201,plano.body);
  const criado=await app.inject({method:"POST",url:"/v1/manutencao/chamados",headers:headers("CH-1"),payload:{patrimonioUnidadeId:"SALA-1",ativoId:"AT-1",planoId:plano.json().id,codigo:"CH-001",titulo:"Ruído anormal na bomba",descricao:"Equipamento apresenta vibração e ruído",tipo:"preventiva",prioridade:"alta",solicitante:"Operação",dados:{}}});assert.equal(criado.statusCode,201,criado.body);let chamado=criado.json();assert.equal(chamado.status,"aberto");
  for(const acao of ["triar","iniciar"]){const r=await app.inject({method:"POST",url:`/v1/manutencao/chamados/${chamado.id}/decisoes`,headers:headers(`CH-${acao}`,chamado.versao),payload:{acao,responsavel:"Equipe hidráulica"}});assert.equal(r.statusCode,201,r.body);chamado=r.json().chamado;}
  const ordem=await app.inject({method:"POST",url:`/v1/manutencao/chamados/${chamado.id}/ordens`,headers:headers("OS-1"),payload:{codigo:"OS-001",equipe:"Equipe hidráulica",dataProgramada:"2026-08-12",diagnostico:"Rolamento com desgaste",dados:{}}});assert.equal(ordem.statusCode,201,ordem.body);
  const recurso=await app.inject({method:"POST",url:`/v1/manutencao/ordens/${ordem.json().id}/recursos`,headers:headers("REC-1"),payload:{tipo:"material",descricao:"Rolamento",unidade:"un",quantidade:2,valorUnitario:125.5}});assert.equal(recurso.statusCode,201,recurso.body);assert.equal(recurso.json().ordem.custoTotal,251);
  for(const [acao,justificativa] of [["resolver","Rolamentos substituídos e equipamento testado"],["fechar","Serviço aceito pela fiscalização"]]){const r=await app.inject({method:"POST",url:`/v1/manutencao/chamados/${chamado.id}/decisoes`,headers:headers(`CH-${acao}`,chamado.versao),payload:{acao,justificativa}});assert.equal(r.statusCode,201,r.body);chamado=r.json().chamado;}
  assert.equal(chamado.status,"fechado");const detalhe=await app.inject({method:"GET",url:`/v1/manutencao/chamados/${chamado.id}`,headers:headers()});assert.equal(detalhe.statusCode,200);assert.equal(detalhe.json().ordens[0].recursos.length,1);assert.equal(detalhe.json().decisoes.length,4);
});
