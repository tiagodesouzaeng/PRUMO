# Sprint 20.1 — Estabilização integrada

## Objetivo

Consolidar a experiência de produto após a implantação do roadmap modular,
retirando rótulos internos das telas operacionais e tornando a Auditoria o ponto
único de acompanhamento da evolução do PRUMO.

## Entregas

- roadmap completo apresentado em `Administração > Auditoria`;
- marcos organizados por fase, situação, resumo e entregas;
- referências numéricas das Sprints removidas dos cabeçalhos operacionais;
- selos obsoletos de Patrimônio, Documentos e Administração substituídos por
  descrições funcionais;
- navegação modular alterada para não exibir todos os módulos quando a API
  retornar um catálogo vazio ou indisponível;
- Fastify, Axios, JOSE e PostgreSQL client atualizados;
- dependências transitivas vulneráveis substituídas por versões corrigidas;
- documentação, versão da API e checkpoint atualizados para `20.1.0`.

## Barreiras preservadas para a próxima fase

- configurar o provedor OIDC do ambiente de produção;
- substituir o texto fixo do banner pelo cliente ativo e disponibilizar seleção
  hierárquica de Site, Prédio e Sala;
- corrigir o botão de exclusão de Sites e apresentar o motivo do bloqueio quando
  existirem vínculos patrimoniais ou operacionais;
- criar uma base de homologação reproduzível com dados fictícios e coerentes de
  três empresas distintas;
- homologar e migrar definitivamente orçamentos, composições e bases locais;
- concluir portais externos, armazenamento binário do GED e fluxos pendentes de
  Convênios e Compliance;
- implantar testes de navegação ponta a ponta, acessibilidade e regressão visual.

## Regra de publicação

Esta entrega permanece local. Commit, push, pull request e deploy dependem de
autorização expressa.

## Validação de encerramento

- 18 módulos percorridos no navegador sem referência numérica de Sprint;
- roadmap exibido na Auditoria com 19 marcos e seis fases;
- 156 testes aprovados e nenhuma falha;
- build de produção concluído;
- auditoria de dependências sem vulnerabilidades conhecidas;
- 28 migrações verificadas no PostgreSQL.
