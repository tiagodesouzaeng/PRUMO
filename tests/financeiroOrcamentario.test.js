import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { aplicarMovimentoFinanceiro, calcularResumoCompromisso, truncarFinanceiro } from "../server/domain/finance.js";

const headers=(chave="",versao="")=>({"x-prumo-tenant-id":"EMP-1","x-prumo-team-id":"EQ-1",...(chave?{"idempotency-key":chave}:{}),...(versao!==""?{"if-match":String(versao)}:{})});
async function apiFinanceira(){return criarAplicacaoApi({repository:criarRepositorioMemoria({tenants:[{id:"EMP-1",nome:"Órgão público",status:"ativo"}],memberships:[{tenantId:"EMP-1",subject:"ADMIN",perfilId:"administrador",teamIds:["EQ-1"],status:"ativo"}],perfilProduto:{tenantId:"EMP-1",perfil:"publico"}}),authenticate:async()=>({subject:"ADMIN"})});}

test("domínio financeiro preserva centavos, deduções e limites de pagamento",()=>{
  assert.equal(truncarFinanceiro(10.239),10.23);
  const compromisso={id:"CF-1",valorTotal:1000,status:"comprometido"};
  const liquidacao=aplicarMovimentoFinanceiro(compromisso,[],{tipo:"liquidacao",valor:600,retencoes:60,glosas:40});
  assert.equal(liquidacao.statusNovo,"parcialmente_liquidado");
  const resumo=calcularResumoCompromisso(compromisso,[{tipo:"liquidacao",valor:600,retencoes:60,glosas:40},{tipo:"pagamento",valor:500}]);
  assert.deepEqual(resumo,{liquidadoBruto:600,retencoes:60,glosas:40,pago:500,liquidadoLiquido:500,saldoCompromisso:400,saldoAPagar:0});
  assert.throws(()=>aplicarMovimentoFinanceiro({...compromisso,status:"liquidado"},[{tipo:"liquidacao",valor:600,retencoes:60,glosas:40}],{tipo:"pagamento",valor:501}),/ultrapassa o saldo/);
});

test("API financeira executa orçamento, compromisso, liquidação, pagamento e conciliação",async(t)=>{
  const api=await apiFinanceira();t.after(()=>api.close());
  const centro=await api.inject({method:"POST",url:"/v1/financeiro/centros-custo",headers:headers("cc-1"),payload:{codigo:"CC-001",nome:"Infraestrutura",responsavel:"Gestor",dados:{}}});
  assert.equal(centro.statusCode,201); const costCenterId=centro.json().id;
  const fonte=await api.inject({method:"POST",url:"/v1/financeiro/fontes",headers:headers("fr-1"),payload:{codigo:"FR-001",nome:"Tesouro",tipo:"tesouro",dados:{}}});
  assert.equal(fonte.statusCode,201); const fundingSourceId=fonte.json().id;
  const orcamento=await api.inject({method:"POST",url:"/v1/financeiro/orcamentos",headers:headers("orc-1"),payload:{costCenterId,fundingSourceId,codigo:"DOT-001",descricao:"Infraestrutura 2026",ano:2026,classificacao:"capex",valorInicial:1000,ajustes:0,dados:{}}});
  assert.equal(orcamento.statusCode,201); const budgetId=orcamento.json().id;
  const compromissoResposta=await api.inject({method:"POST",url:"/v1/financeiro/compromissos",headers:headers("cf-1"),payload:{budgetId,codigo:"EMP-001",descricao:"Serviços de engenharia",origemTipo:"manual",competencia:"2026-08-01",dataVencimento:"2026-08-30",valorTotal:1000,beneficiario:"Fornecedor",dados:{}}});
  assert.equal(compromissoResposta.statusCode,201); let compromisso=compromissoResposta.json();

  async function movimentar(tipo,payload={}){const resposta=await api.inject({method:"POST",url:`/v1/financeiro/compromissos/${compromisso.id}/movimentos`,headers:headers(`mov-${tipo}-${compromisso.versao}`,compromisso.versao),payload:{tipo,...payload}});assert.equal(resposta.statusCode,201,resposta.body);compromisso=resposta.json().compromisso;return resposta.json();}
  await movimentar("reserva",{valor:1000}); assert.equal(compromisso.status,"reservado");
  await movimentar("compromisso",{valor:1000}); assert.equal(compromisso.status,"comprometido");
  await movimentar("liquidacao",{valor:600,retencoes:60,glosas:40,documento:"NF-001"}); assert.equal(compromisso.resumo.saldoAPagar,500);
  const pagamento=await movimentar("pagamento",{valor:500,referenciaExterna:"PAG-001"}); assert.equal(compromisso.status,"parcialmente_pago");
  await movimentar("liquidacao",{valor:400,retencoes:0,glosas:0,documento:"NF-002"});
  await movimentar("pagamento",{valor:400,referenciaExterna:"PAG-002"}); assert.equal(compromisso.status,"pago"); assert.equal(compromisso.resumo.pago,900);

  const conciliacao=await api.inject({method:"POST",url:`/v1/financeiro/movimentos/${pagamento.movimento.id}/conciliacoes`,headers:headers("conc-1"),payload:{referenciaExterna:"EXTRATO-001",status:"conciliado",diferenca:0}});
  assert.equal(conciliacao.statusCode,201);
  const resumo=await api.inject({method:"GET",url:"/v1/financeiro/resumo?ano=2026",headers:headers()}); assert.equal(resumo.statusCode,200); assert.equal(resumo.json().previsto,1000); assert.equal(resumo.json().pago,900); assert.equal(resumo.json().terminologia.compromisso,"Empenho");
  const excesso=await api.inject({method:"POST",url:"/v1/financeiro/compromissos",headers:headers("cf-2"),payload:{budgetId,codigo:"EMP-002",descricao:"Excede orçamento",origemTipo:"manual",competencia:"2026-08-01",valorTotal:1,dados:{}}}); assert.equal(excesso.statusCode,422);
});
