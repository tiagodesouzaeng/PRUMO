import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { calcularMedicao, calcularProgressoObra, resolverTransicaoMedicao, resolverTransicaoObra } from "../server/domain/construction.js";

const headers=(chave="",versao="")=>({"x-prumo-tenant-id":"EMP-1","x-prumo-team-id":"EQ-1",...(chave?{"idempotency-key":chave}:{}),...(versao!==""?{"if-match":String(versao)}:{})});
async function criarApi(){return criarAplicacaoApi({repository:criarRepositorioMemoria({tenants:[{id:"EMP-1",nome:"Órgão",status:"ativo"}],memberships:[{tenantId:"EMP-1",subject:"ADMIN",perfilId:"administrador",teamIds:["EQ-1"],status:"ativo"}],unidadesPatrimoniais:[{id:"SALA-1",tenantId:"EMP-1",teamId:"EQ-1",nivel:"sala",codigo:"SL-01",nome:"Sala técnica",status:"ativo",versao:1}]}),authenticate:async()=>({subject:"ADMIN"})});}

test("domínio de obras governa saldo, deduções e transições",()=>{
  assert.deepEqual(resolverTransicaoObra("planejamento","iniciar"),{de:["planejamento","suspensa"],para:"em_andamento",permissao:"obras.editar"});
  assert.equal(resolverTransicaoMedicao("em_analise","aprovar").para,"aprovada");
  assert.deepEqual(calcularMedicao({valorBruto:1000.239,retencoes:100,glosas:50,multas:25},2000),{valorBruto:1000.23,retencoes:100,glosas:50,multas:25,valorLiquido:825.23});
  assert.equal(calcularProgressoObra({valorPrevisto:10000},[{status:"aprovada",valorBruto:2500}]).progressoFinanceiro,25);
  assert.throws(()=>calcularMedicao({valorBruto:1001,retencoes:0,glosas:0,multas:0},1000),/ultrapassa o saldo/);
});
test("API executa obra, cronograma, diário e medição até o aceite",async(t)=>{
  const app=await criarApi();t.after(()=>app.close());
  const criada=await app.inject({method:"POST",url:"/v1/obras",headers:headers("OBRA-1"),payload:{patrimonioUnidadeId:"SALA-1",codigo:"OB-001",nome:"Reforma da sala técnica",responsavel:"Fiscal",dataInicio:"2026-08-01",dataFimPrevista:"2026-12-20",valorPrevisto:100000,dados:{}}});
  assert.equal(criada.statusCode,201,criada.body);let obra=criada.json();
  let decisao=await app.inject({method:"POST",url:`/v1/obras/${obra.id}/decisoes`,headers:headers("INICIAR",obra.versao),payload:{acao:"iniciar"}});assert.equal(decisao.statusCode,201,decisao.body);obra=decisao.json().obra;assert.equal(obra.status,"em_andamento");
  assert.equal((await app.inject({method:"POST",url:`/v1/obras/${obra.id}/cronograma`,headers:headers("ETAPA-1"),payload:{codigo:"ET-01",titulo:"Demolições",dataInicio:"2026-08-01",dataFim:"2026-08-15",peso:10,progresso:0,valorPrevisto:10000,dados:{}}})).statusCode,201);
  assert.equal((await app.inject({method:"POST",url:`/v1/obras/${obra.id}/diario`,headers:headers("DIARIO-1"),payload:{dataRegistro:"2026-08-02",clima:"Ensolarado",efetivo:8,atividades:"Mobilização e isolamento da área",ocorrencias:"Sem ocorrências",evidencias:[]}})).statusCode,201);
  const medicaoCriada=await app.inject({method:"POST",url:`/v1/obras/${obra.id}/medicoes`,headers:headers("MED-1"),payload:{numero:1,periodoInicio:"2026-08-01",periodoFim:"2026-08-31",valorBruto:20000,retencoes:1000,glosas:500,multas:0,itens:[],dados:{}}});assert.equal(medicaoCriada.statusCode,201,medicaoCriada.body);let medicao=medicaoCriada.json();assert.equal(medicao.valorLiquido,18500);
  for(const acao of ["enviar","aprovar","aceitar"]){decisao=await app.inject({method:"POST",url:`/v1/medicoes/${medicao.id}/decisoes`,headers:headers(`MED-${acao}`,medicao.versao),payload:{acao,justificativa:"Fiscalização conferida"}});assert.equal(decisao.statusCode,201,decisao.body);medicao=decisao.json().medicao;}
  assert.equal(medicao.status,"aceita");const detalhe=await app.inject({method:"GET",url:`/v1/obras/${obra.id}`,headers:headers()});assert.equal(detalhe.statusCode,200);assert.equal(detalhe.json().cronograma.length,1);assert.equal(detalhe.json().diario.length,1);assert.equal(detalhe.json().resumo.valorMedido,20000);
});
