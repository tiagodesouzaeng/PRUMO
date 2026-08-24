# Sprint 28 — Governança documental por entidade

## Objetivo

Garantir que todo documento técnico exista em razão de uma entidade real do
PRUMO e permaneça rastreável durante sua revisão, aprovação e guarda.

## Entregas

- origem principal obrigatória na criação de documentos;
- catálogo corporativo de entidades acessíveis no PostgreSQL;
- suporte a patrimônio, ativos, solicitações, orçamentos, contratações, pedidos,
  contratos, obras, medições, manutenção, regularidade e convênios;
- relações adicionais sem duplicar o arquivo armazenado;
- busca no acervo e identificação visual da origem e das relações;
- fluxo rascunho → em revisão → aprovado → arquivado;
- devolução da revisão para correção;
- versão de controle e proteção contra gravação concorrente;
- aprovação e arquivamento sujeitos a permissão própria;
- versões binárias imutáveis, SHA-256, RLS, auditoria e idempotência preservados;
- limpeza de testes documentais restrita à identidade de migração.

## Regra permanente

O GED não é uma pasta isolada. Um novo documento somente pode ser criado quando
seu registro de origem existir no mesmo contexto de empresa e equipe. Relações
adicionais não substituem nem removem a origem principal.
