# Sprint 12 — Demandas e Carteira de Investimentos

## Resultado

A Sprint 12 cria a entrada governada de necessidades no PRUMO. Cada demanda
referencia a estrutura canônica `Cliente > Site > Prédio > Sala`, recebe uma
pontuação comparável e percorre análise, priorização e aprovação antes de poder
integrar uma carteira anual de investimentos.

Situação local: concluída na versão `12.0.0`, aguardando homologação do usuário.

## Entregas funcionais

- módulo `Demandas e Investimentos` no catálogo, licenciamento e navegação;
- programas estratégicos com período e limite financeiro;
- demandas vinculadas obrigatoriamente a uma unidade patrimonial ativa;
- categorias, solicitante, descrição, valor estimado e data desejada;
- pontuação de 20 a 100 com pesos de urgência (30%), impacto (30%), risco (20%)
  e alinhamento estratégico (20%);
- fluxo auditável `rascunho > em análise > priorizada > aprovada > incorporada`;
- rejeição justificada e reabertura controlada;
- carteiras e planos anuais com limite financeiro, ordenação e valor planejado;
- histórico imutável de todas as decisões;
- interface responsiva com indicadores, filtros, editor, detalhe e linha do tempo.

## Banco, segurança e API

A migração `018_demandas_carteira_investimentos.sql` cria programas, carteiras,
demandas, vínculos e decisões. Todas as tabelas usam RLS forçado por empresa e
equipe. A conta da API não recebe permissão de exclusão e as decisões não podem
ser atualizadas nem removidas.

Permissões:

- `planejamento.consultar`;
- `planejamento.editar`;
- `planejamento.priorizar`;
- `planejamento.aprovar`.

Principais rotas:

- `GET|POST /v1/planejamento/programas` e `PUT /:id`;
- `GET|POST /v1/planejamento/carteiras` e `PUT /:id`;
- `POST /v1/planejamento/carteiras/:id/demandas`;
- `GET|POST /v1/planejamento/demandas`;
- `GET|PUT /v1/planejamento/demandas/:id`;
- `GET|POST /v1/planejamento/demandas/:id/decisoes`.

Criações, decisões e incorporações são idempotentes. Edições e transições exigem
a versão conhecida no cabeçalho `If-Match`.

## Validação de encerramento

- 19 migrações aplicadas com checksum preservado;
- 120 testes aprovados, sem falhas ou testes ignorados;
- testes reais confirmaram RLS, isolamento por equipe e fluxo completo no PostgreSQL;
- build Vite aprovado;
- API e interface preparadas para execução local e homologação;
- backup `prumo-20260809T225130Z.backup` verificado e restaurado com sucesso.

## Roteiro de homologação

1. abrir `Demandas` no menu lateral;
2. criar um programa e uma carteira anual;
3. criar uma demanda vinculada a um Cliente, Site, Prédio ou Sala;
4. ajustar os quatro critérios e confirmar a pontuação calculada;
5. enviar para análise, priorizar e aprovar;
6. incorporar a demanda na carteira e conferir o consumo do limite financeiro;
7. consultar o histórico de decisões e os eventos de auditoria.

## Continuidade

A próxima etapa é a Sprint 13 — Suprimentos e Contratações. Ela consumirá as
demandas incorporadas e os orçamentos existentes para iniciar planejamento da
contratação, estudos, riscos, pesquisa de preços, seleção e aquisição.
