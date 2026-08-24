# Sprint 31 — PPCI operacional e utilidades mensuráveis

## Resultado

A versão `31.0.0` transforma os ajustes de homologação em recursos
corporativos persistidos. Sistemas preventivos do PPCI podem ser alterados e
removidos; quando já possuem inspeções, a remoção é uma inativação auditada e
o histórico permanece disponível. PPCIs e seus sistemas abrem o GED já no
contexto correto.

Utilidades deixa de usar indicadores escritos no frontend. Medidores de água,
energia, gás, combustíveis e outros recursos passam ao PostgreSQL, vinculados
a Site, Prédio, Sala e, opcionalmente, ativo. Leituras de consumo, geração,
crédito e débito são imutáveis e isoladas por organização e equipe.

## Correções incluídas

- edição e remoção de sistemas de proteção do PPCI;
- seleção de usuários e grupos ativos como responsáveis nos fluxos ajustados;
- vínculo contextual de PPCI e sistemas ao GED;
- cadastro, alteração, remoção e página de leituras de medidores;
- erro de cadastro patrimonial exibido dentro do formulário, sem perder dados;
- edição de Solicitações e abertura completa dos itens de Carteiras;
- permissões, concorrência otimista, auditoria e RLS nos novos fluxos.

## Persistência

- `039_operacao_ppci_utilidades_v31.sql` — tabelas, RLS e ciclo operacional;
- `040_endurecimento_utilidades_v31.sql` — limpeza segura de integração;
- `041_permissoes_utilidades_v31.sql` — permissões segregadas;
- `042_responsaveis_corporativos_v31.sql` — catálogo seguro do cliente ativo.

## Aceite

- testes unitários e de API para PPCI, Utilidades e responsáveis;
- teste PostgreSQL de isolamento entre equipes;
- migrações aplicadas com checksum;
- suíte completa e build de produção aprovados.
