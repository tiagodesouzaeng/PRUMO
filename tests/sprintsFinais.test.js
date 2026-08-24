import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { calcularResumoConvenio,resolverTransicaoConvenio } from "../server/domain/agreements.js";
import { calcularNivelRisco,classificarRequisito,sanitizarPublicacao } from "../server/domain/compliance.js";
import { gerarCredencialPortal,validarEscopoPortal } from "../server/domain/intelligence.js";

const cab=(chave="",versao="")=>({"x-prumo-tenant-id":"EMP-1","x-prumo-team-id":"EQ-1",...(chave?{"idempotency-key":chave}:{}),...(versao!==""?{"if-match":String(versao)}:{})});
async function api(){return criarAplicacaoApi({repository:criarRepositorioMemoria({tenants:[{id:"EMP-1",nome:"Federação",status:"ativo"}],memberships:[{tenantId:"EMP-1",subject:"ADMIN",perfilId:"administrador",teamIds:["EQ-1"],status:"ativo"}],unidadesPatrimoniais:[{id:"SALA-1",tenantId:"EMP-1",teamId:"EQ-1",nivel:"sala",codigo:"SL-01",nome:"Sala técnica",status:"ativo",versao:1}]}),authenticate:async()=>({subject:"ADMIN"})});}

test("domínio de convênios governa transições e consolida execução",()=>{
 assert.equal(resolverTransicaoConvenio("rascunho","ativar").para,"vigente");
 const resumo=calcularResumoConvenio({valorRepasse:1000,valorContrapartida:100},[{status:"concluida"}],[{tipo:"repasse",status:"recebido",valor:800}],[{valorExecutado:350}],[{status:"aberta"}]);
 assert.deepEqual(resumo,{valorTotal:1100,recebido:800,executado:350,saldoExecutar:750,metasTotal:1,metasConcluidas:1,diligenciasAbertas:1});
});

test("API executa convênio, meta, repasse, execução e prestação de contas",async t=>{const app=await api();t.after(()=>app.close());
 let r=await app.inject({method:"POST",url:"/v1/convenios",headers:cab("cv-1"),payload:{codigo:"CV-001",titulo:"Modernização",concedente:"União",convenente:"Federação",objeto:"Modernizar instalações",dataInicio:"2026-01-01",dataFim:"2027-12-31",valorRepasse:100000,valorContrapartida:10000,dados:{}}});assert.equal(r.statusCode,201,r.body);let cv=r.json();
 r=await app.inject({method:"POST",url:`/v1/convenios/${cv.id}/decisoes`,headers:cab("cv-ativar",cv.versao),payload:{acao:"ativar"}});assert.equal(r.statusCode,200,r.body);cv=r.json();
 r=await app.inject({method:"POST",url:`/v1/convenios/${cv.id}/metas`,headers:cab("meta-1"),payload:{codigo:"M-01",descricao:"Reformar unidades",unidade:"un",quantidadePrevista:2,valorPrevisto:90000,dados:{}}});assert.equal(r.statusCode,201,r.body);
 r=await app.inject({method:"POST",url:`/v1/convenios/${cv.id}/repasses`,headers:cab("rep-1"),payload:{tipo:"repasse",valor:50000,status:"recebido",dataRealizada:"2026-08-11",dados:{}}});assert.equal(r.statusCode,201,r.body);
 r=await app.inject({method:"POST",url:`/v1/convenios/${cv.id}/execucoes`,headers:cab("exe-1"),payload:{dataExecucao:"2026-08-11",descricao:"Primeira etapa",valorExecutado:20000,dados:{}}});assert.equal(r.statusCode,201,r.body);
 r=await app.inject({method:"POST",url:`/v1/convenios/${cv.id}/prestacoes`,headers:cab("pc-1"),payload:{tipo:"parcial",periodoInicio:"2026-01-01",periodoFim:"2026-08-31",valorInformado:20000,dados:{}}});assert.equal(r.statusCode,201,r.body);
 const detalhe=await app.inject({method:"GET",url:`/v1/convenios/${cv.id}`,headers:cab()});assert.equal(detalhe.statusCode,200);assert.equal(detalhe.json().resumo.executado,20000);assert.equal(detalhe.json().metas.length,1);assert.equal(detalhe.json().prestacoes.length,1);
});

test("compliance classifica vencimentos, matriz de risco e conteúdo público",()=>{assert.equal(classificarRequisito({status:"regular",dataValidade:"2026-01-01"},new Date("2026-08-11T00:00:00Z")),"vencido");assert.deepEqual(calcularNivelRisco(5,4),{nivel:20,faixa:"critico"});assert.deepEqual(sanitizarPublicacao({codigo:"P",titulo:"T",categoria:"C",descricaoPublica:"D",periodoReferencia:"2026",conteudo:{total:1},publicadoEm:"agora",dadosInternos:{segredo:true}}),{codigo:"P",titulo:"T",categoria:"C",descricaoPublica:"D",periodoReferencia:"2026",conteudo:{total:1},publicadoEm:"agora"});});

test("API registra regularidade, risco, auditoria e publicação autorizada",async t=>{const app=await api();t.after(()=>app.close());
 let r=await app.inject({method:"POST",url:"/v1/regularidade/requisitos",headers:cab("reg-1"),payload:{patrimonioUnidadeId:"SALA-1",codigo:"REG-001",tipo:"ppci",titulo:"PPCI da unidade",numeroDocumento:"PPCI-1",dataValidade:"2026-08-01",criticidade:"alta",dados:{}}});assert.equal(r.statusCode,201,r.body);
 r=await app.inject({method:"POST",url:"/v1/regularidade/riscos",headers:cab("risco-1"),payload:{codigo:"RSC-001",titulo:"Operação sem licença",descricao:"Risco regulatório",probabilidade:5,impacto:5,controle:"Monitoramento mensal",dados:{}}});assert.equal(r.statusCode,201,r.body);assert.equal(r.json().nivel,25);
 r=await app.inject({method:"POST",url:"/v1/regularidade/auditorias",headers:cab("aud-1"),payload:{codigo:"AUD-001",titulo:"Auditoria anual",escopo:"Regularidade predial",dataAuditoria:"2026-08-11",auditor:"Auditoria interna",conclusao:"Controles avaliados",classificacao:"ressalva",evidencias:[],dados:{}}});assert.equal(r.statusCode,201,r.body);
 r=await app.inject({method:"POST",url:"/v1/regularidade/transparencia",headers:cab("pub-1"),payload:{codigo:"PUB-001",titulo:"Execução anual",categoria:"obras",descricaoPublica:"Resumo autorizado",conteudo:{total:1},dadosInternos:{nota:"restrita"}}});assert.equal(r.statusCode,201,r.body);const pub=r.json();r=await app.inject({method:"POST",url:`/v1/regularidade/transparencia/${pub.id}/publicacao`,headers:cab("",pub.versao)});assert.equal(r.statusCode,200,r.body);assert.equal(r.json().status,"publicada");
});

test("portais usam credencial aleatória, hash e escopo segregado",()=>{const a=gerarCredencialPortal(),b=gerarCredencialPortal();assert.notEqual(a.token,b.token);assert.equal(a.tokenHash.length,64);assert.deepEqual(validarEscopoPortal("cliente",{clienteId:"C-1",obraIds:["O-1"]}),{clienteId:"C-1",obraIds:["O-1"]});assert.throws(()=>validarEscopoPortal("fornecedor",{clienteId:"C-1"}),/escopo/i);});

test("API consolida BI, relatórios, portais, integrações e observabilidade",async t=>{const app=await api();t.after(()=>app.close());
 let r=await app.inject({method:"POST",url:"/v1/relatorios/definicoes",headers:cab("rel-1"),payload:{codigo:"REL-001",nome:"Painel diretoria",modulos:["obras","financeiro"],configuracao:{},compartilhado:true}});assert.equal(r.statusCode,201,r.body);
 r=await app.inject({method:"POST",url:"/v1/portais/acessos",headers:cab("portal-1"),payload:{tipo:"cliente",nome:"Cliente externo",email:"cliente@example.com",escopo:{clienteId:"C-1"},expiraEm:"2027-01-01T02:59:59.000Z"}});assert.equal(r.statusCode,201,r.body);assert.ok(r.json().token);assert.equal(r.headers["cache-control"],"no-store");
 r=await app.inject({method:"POST",url:"/v1/integracoes/canais",headers:cab("int-1"),payload:{codigo:"INT-001",nome:"Contabilidade",tipo:"contabil",direcao:"saida",configuracaoPublica:{ambiente:"homologacao"},segredoReferencia:"vault://prumo/contabil"}});assert.equal(r.statusCode,201,r.body);
 const [bi,op]=await Promise.all([app.inject({method:"GET",url:"/v1/bi/executivo",headers:cab()}),app.inject({method:"GET",url:"/v1/operacao/observabilidade",headers:cab()})]);assert.equal(bi.statusCode,200,bi.body);assert.equal(bi.json().seguranca.isolamento,"RLS");assert.equal(op.statusCode,200,op.body);assert.equal(op.json().status,"operacional");
});
