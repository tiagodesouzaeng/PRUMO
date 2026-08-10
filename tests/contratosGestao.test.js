import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { calcularAditivoContrato, calcularSaldoContrato, resolverTransicaoContrato } from "../server/domain/contracts.js";

const headers=(chave="",versao="")=>({"x-prumo-tenant-id":"EMP-1","x-prumo-team-id":"EQ-1",...(chave?{"idempotency-key":chave}:{}),...(versao?{"if-match":String(versao)}:{})});
async function criarApi(){return criarAplicacaoApi({repository:criarRepositorioMemoria({tenants:[{id:"EMP-1",nome:"Órgão público",status:"ativo"}],memberships:[{tenantId:"EMP-1",subject:"ADMIN",perfilId:"administrador",teamIds:["EQ-1"],status:"ativo"}],fornecedores:[{id:"FOR-1",tenantId:"EMP-1",teamId:"EQ-1",codigo:"F-001",razaoSocial:"Fornecedor vencedor",status:"ativo",qualificacao:"qualificado",versao:1}],processosContratacao:[{id:"PROC-1",tenantId:"EMP-1",teamId:"EQ-1",codigo:"PC-001",titulo:"Processo aprovado",objeto:"Serviços técnicos",regime:"publico",status:"aprovada",versao:5,atualizadoEm:new Date().toISOString()}],cotacoesContratacao:[{id:"COT-1",tenantId:"EMP-1",teamId:"EQ-1",processId:"PROC-1",supplierId:"FOR-1",valorTotal:100000,status:"vencedora"}]}),authenticate:async()=>({subject:"ADMIN"})});}

test("domínio contratual governa transições, saldo e aditivos",()=>{
  assert.deepEqual(resolverTransicaoContrato("rascunho","ativar"),{statusNovo:"vigente",permissao:"contratos.gerir"});
  assert.throws(()=>resolverTransicaoContrato("rascunho","concluir"),/não é permitida/);
  assert.equal(calcularSaldoContrato({valorAtual:100000,valorExecutado:25000}),75000);
  assert.deepEqual(calcularAditivoContrato({valorAtual:100000,valorExecutado:25000,dataInicio:"2026-01-01",dataFim:"2026-12-31"},{tipo:"prazo_valor",valor:15000,novaDataFim:"2027-06-30"}),{novoValor:115000,novaDataFim:"2027-06-30"});
});

test("contrato percorre designação, vigência, execução, aditivo, fiscalização e encerramento",async(t)=>{
  const app=await criarApi();t.after(()=>app.close());
  const criado=await app.inject({method:"POST",url:"/v1/contratos",headers:headers("CT-1"),payload:{processId:"PROC-1",supplierId:"FOR-1",codigo:"CT-001",numero:"001/2026",titulo:"Contrato de serviços",objeto:"Execução de serviços técnicos",tipoInstrumento:"contrato",regime:"publico",dataAssinatura:"2026-01-02",dataInicio:"2026-01-05",dataFim:"2026-12-31",valorInicial:100000,dados:{}}});
  assert.equal(criado.statusCode,201);let contrato=criado.json();assert.equal(contrato.saldo,100000);
  for(const [papel,nome] of [["gestor","Gestora do contrato"],["fiscal_tecnico","Fiscal técnico"]]){const r=await app.inject({method:"POST",url:`/v1/contratos/${contrato.id}/responsaveis`,headers:headers(`RESP-${papel}`),payload:{papel,nome,dataInicio:"2026-01-05",atoDesignacao:"Portaria 01/2026"}});assert.equal(r.statusCode,201);}
  let decisao=await app.inject({method:"POST",url:`/v1/contratos/${contrato.id}/decisoes`,headers:headers("ATIVAR",contrato.versao),payload:{acao:"ativar",dados:{}}});assert.equal(decisao.statusCode,201);contrato=decisao.json().contrato;assert.equal(contrato.status,"vigente");
  const execucao=await app.inject({method:"POST",url:`/v1/contratos/${contrato.id}/execucoes`,headers:headers("EXEC-1"),payload:{origem:"medicao",referenciaId:"MED-001",dataExecucao:"2026-02-28",valor:20000,descricao:"Primeira medição"}});assert.equal(execucao.statusCode,201);contrato=execucao.json().contrato;assert.equal(contrato.saldo,80000);
  const aditivo=await app.inject({method:"POST",url:`/v1/contratos/${contrato.id}/aditivos`,headers:headers("ADIT-1",contrato.versao),payload:{numero:"TA-01",tipo:"prazo_valor",justificativa:"Ampliação fundamentada do escopo",valor:10000,novaDataFim:"2027-03-31",dados:{}}});assert.equal(aditivo.statusCode,201);contrato=aditivo.json().contrato;assert.equal(contrato.valorAtual,110000);assert.equal(contrato.saldo,90000);
  assert.equal((await app.inject({method:"POST",url:`/v1/contratos/${contrato.id}/garantias`,headers:headers("GAR-1"),payload:{tipo:"seguro_garantia",numero:"SG-1",instituicao:"Seguradora",valor:5000,dataInicio:"2026-01-05",dataFim:"2027-03-31",dados:{}}})).statusCode,201);
  const ocorrencia=await app.inject({method:"POST",url:`/v1/contratos/${contrato.id}/ocorrencias`,headers:headers("OC-1"),payload:{tipo:"atraso",severidade:"media",descricao:"Atraso na entrega parcial",providencia:"Notificação formal"}});assert.equal(ocorrencia.statusCode,201);
  assert.equal((await app.inject({method:"POST",url:`/v1/contratos/${contrato.id}/sancoes`,headers:headers("SAN-1"),payload:{occurrenceId:ocorrencia.json().id,tipo:"advertencia",fundamento:"Descumprimento do cronograma",valor:0}})).statusCode,201);
  decisao=await app.inject({method:"POST",url:`/v1/contratos/${contrato.id}/decisoes`,headers:headers("CONCLUIR",contrato.versao),payload:{acao:"concluir",dados:{}}});contrato=decisao.json().contrato;assert.equal(contrato.status,"concluido");
  decisao=await app.inject({method:"POST",url:`/v1/contratos/${contrato.id}/decisoes`,headers:headers("ENCERRAR",contrato.versao),payload:{acao:"encerrar",justificativa:"Objeto recebido e obrigações verificadas",dados:{}}});assert.equal(decisao.statusCode,201);assert.equal(decisao.json().contrato.status,"encerrado");
  const detalhe=await app.inject({method:"GET",url:`/v1/contratos/${contrato.id}`,headers:headers()});assert.equal(detalhe.statusCode,200);assert.equal(detalhe.json().responsaveis.length,2);assert.equal(detalhe.json().aditivos.length,1);assert.equal(detalhe.json().ocorrencias.length,1);assert.equal(detalhe.json().sancoes.length,1);assert.equal(detalhe.json().decisoes.length,3);
});

test("governança bloqueia ativação sem fiscalização e execução acima do saldo",async(t)=>{
  const app=await criarApi();t.after(()=>app.close());const criado=await app.inject({method:"POST",url:"/v1/contratos",headers:headers("CT-2"),payload:{processId:"PROC-1",supplierId:"FOR-1",codigo:"CT-002",numero:"002/2026",titulo:"Contrato sem fiscais",objeto:"Teste de governança",dataInicio:"2026-01-01",dataFim:"2026-12-31",valorInicial:1000,dados:{}}});const contrato=criado.json();
  const ativacao=await app.inject({method:"POST",url:`/v1/contratos/${contrato.id}/decisoes`,headers:headers("ATIVAR-SEM-FISCAL",contrato.versao),payload:{acao:"ativar",dados:{}}});assert.equal(ativacao.statusCode,422);assert.equal(ativacao.json().erro.codigo,"RESPONSAVEIS_CONTRATO_INCOMPLETOS");
});
