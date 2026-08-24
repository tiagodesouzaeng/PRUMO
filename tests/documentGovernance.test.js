import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { resolverTransicaoDocumento, validarTipoEntidadeDocumental } from "../shared/documentGovernance.js";

const headers=(chave="")=>({"x-prumo-tenant-id":"EMP-1","x-prumo-team-id":"EQ-1",...(chave?{"idempotency-key":chave}:{})});
function api(){return criarAplicacaoApi({repository:criarRepositorioMemoria({
  tenants:[{id:"EMP-1",nome:"Empresa",status:"ativo"}],
  memberships:[{tenantId:"EMP-1",subject:"ADMIN",perfilId:"administrador",teamIds:["EQ-1"],status:"ativo"}],
  orcamentos:[{id:"ORC-1",tenantId:"EMP-1",teamId:"EQ-1",nome:"Orçamento principal"}],
  empreendimentos:[{id:"OBRA-1",tenantId:"EMP-1",teamId:"EQ-1",codigo:"OB-01",nome:"Reforma"}],
}),authenticate:async()=>({subject:"ADMIN"})});}

test("catálogo documental aceita somente tipos governados",()=>{
  assert.deepEqual(validarTipoEntidadeDocumental({moduleId:"obras",entidadeTipo:"obra",entidadeId:"OBRA-1"}),{moduleId:"obras",entidadeTipo:"obra",entidadeId:"OBRA-1"});
  assert.throws(()=>validarTipoEntidadeDocumental({moduleId:"qualquer",entidadeTipo:"texto",entidadeId:"1"}),/entidade válida/);
  assert.equal(resolverTransicaoDocumento({status:"rascunho",versaoAtual:1},"submeter"),"em_revisao");
  assert.throws(()=>resolverTransicaoDocumento({status:"rascunho",versaoAtual:0},"submeter"),/ao menos uma versão/);
});

test("documento nasce vinculado, é filtrável e percorre aprovação com concorrência",async(t)=>{
  const app=await api();t.after(()=>app.close());
  const semOrigem=await app.inject({method:"POST",url:"/v1/documentos",headers:headers("sem"),payload:{titulo:"Sem origem"}});
  assert.equal(semOrigem.statusCode,400);
  const criado=await app.inject({method:"POST",url:"/v1/documentos",headers:headers("doc"),payload:{titulo:"Projeto executivo",vinculo:{moduleId:"obras",entidadeTipo:"obra",entidadeId:"OBRA-1"}}});
  assert.equal(criado.statusCode,201,criado.body);assert.equal(criado.json().vinculos[0].principal,true);
  const invalido=await app.inject({method:"POST",url:`/v1/documentos/${criado.json().id}/vinculos`,headers:headers(),payload:{moduleId:"orcamentos",entidadeTipo:"orcamento",entidadeId:"INEXISTENTE"}});
  assert.equal(invalido.statusCode,422);
  await app.inject({method:"POST",url:`/v1/documentos/${criado.json().id}/versoes`,headers:headers(),payload:{nomeArquivo:"projeto.pdf",sha256:"a".repeat(64),storageKey:"seguro/projeto.pdf"}});
  const submetido=await app.inject({method:"POST",url:`/v1/documentos/${criado.json().id}/decisoes`,headers:{...headers(),"if-match":"1"},payload:{acao:"submeter"}});
  assert.equal(submetido.json().status,"em_revisao");
  const conflito=await app.inject({method:"POST",url:`/v1/documentos/${criado.json().id}/decisoes`,headers:{...headers(),"if-match":"1"},payload:{acao:"aprovar"}});
  assert.equal(conflito.statusCode,412);
  const aprovado=await app.inject({method:"POST",url:`/v1/documentos/${criado.json().id}/decisoes`,headers:{...headers(),"if-match":"2"},payload:{acao:"aprovar"}});
  assert.equal(aprovado.json().status,"aprovado");assert.equal(aprovado.json().versao,3);
  const filtrados=await app.inject({method:"GET",url:"/v1/documentos?moduleId=obras&entidadeId=OBRA-1",headers:headers()});
  assert.equal(filtrados.json().length,1);
});
