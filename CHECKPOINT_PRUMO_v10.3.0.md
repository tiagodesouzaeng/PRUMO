# Checkpoint PRUMO v10.3.0

Data: 30/07/2026

## Encerramento da Sprint 10.3

- PostgreSQL corporativo e migrações executáveis;
- isolamento por empresa e equipe com RLS forçado;
- API com contexto validado, idempotência e controle de concorrência;
- catálogo corporativo de bases, publicações, preços e composições;
- migração assistida com validação e homologação administrativa;
- fila durável e workers para importações e cálculos;
- transição reversível entre repositórios local, híbrido e corporativo.

## Segurança e recuperação

- leitura de orçamento de outra empresa bloqueada;
- gravação em outra empresa rejeitada pelo PostgreSQL;
- orçamento de outra equipe ocultado;
- trabalho pendente retomado e concluído;
- falha preservada com diagnóstico;
- reprocessamento limitado ao máximo de tentativas;
- dados técnicos de teste removidos.

## Validação

- suíte automatizada completa aprovada;
- testes de integração executados no PostgreSQL 18.4 local;
- build de produção concluído;
- interface administrativa validada localmente.

## Publicação

Este checkpoint corresponde à versão solicitada para publicação no GitHub e
no Netlify.
