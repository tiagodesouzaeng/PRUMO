# Sprint 26.1 — Consolidação funcional dos módulos

## Resultado

A navegação foi alinhada à arquitetura modular definida para o produto.

- PPCI passa a ser uma área interna de Regularidade e Segurança Predial;
- alertas permanecem na Visão geral, em vez de ocupar um módulo independente;
- consulta de bases e composições integra Orçamentos e Bases de Preços;
- publicação e governança das bases oficiais e comerciais ficam na
  Administração;
- Consumo Hídrico evolui para Utilidades, Energia e Consumos, incluindo água,
  energia, geração, créditos, débitos, gás e outros medidores;
- Demandas recebe o nome operacional Solicitações e Investimentos;
- permissões históricas são preservadas e redirecionadas aos módulos canônicos.

## Compatibilidade

A migração 030 inativa os módulos duplicados sem apagar seus registros e
reassocia as permissões. Rotas e contratos internos antigos permanecem quando
necessários para compatibilidade da API e migração de dados.
