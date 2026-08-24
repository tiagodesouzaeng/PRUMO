# Sprint 15 — Financeiro-orçamentário

## Resultado

A Sprint 15 conclui a execução financeira gerencial entre Planejamento,
Suprimentos, Contratos, Medições e os futuros módulos de prestação de contas. O
PRUMO controla previsto, comprometido, liquidado e pago sem substituir os
sistemas fiscais, contábeis, bancários ou trabalhistas especializados.

Situação local: concluída na versão `15.0.0`, aguardando homologação do usuário.

## Escopo entregue

- centros de custo e responsáveis;
- fontes de recursos próprias, públicas, transferidas, conveniadas ou financiadas;
- orçamento anual por centro, fonte e natureza CAPEX/OPEX;
- valor inicial, ajustes, consumido e saldo disponível;
- compromissos manuais ou originados por pedidos, contratos e medições;
- perfis público, federação e privado com terminologia compatível;
- reserva, compromisso/empenho, liquidação/aprovação financeira e pagamento;
- liquidações parciais, retenções, glosas e valor líquido;
- fluxo projetado por competência e vencimento;
- conciliação com referências de sistemas contábeis, bancários e oficiais;
- realizado contra previsto no resumo anual;
- API, interface responsiva, idempotência, controle de versão e auditoria.

## Governança

As permissões foram segregadas em consulta, planejamento, compromisso,
liquidação, pagamento e conciliação. Um compromisso nunca pode ultrapassar o
saldo do orçamento. A liquidação não supera o valor comprometido e o pagamento
não supera o líquido liquidado. Retenções e glosas não podem exceder o movimento
e históricos financeiros não podem ser editados ou excluídos pela API.

Fluxo principal:

`Rascunho > Reservado > Comprometido > Liquidado > Pago`

Liquidações e pagamentos podem ser parciais. Compromissos sem execução podem ser
cancelados mediante justificativa. A regra financeira preserva o truncamento em
duas casas decimais adotado pelo PRUMO.

## Perfis organizacionais

- público: dotação, reserva, empenho, liquidação e pagamento;
- federação/privado: orçamento, reserva, compromisso, aprovação financeira e pagamento.

O domínio interno permanece único; apenas a terminologia e os modelos de uso se
adaptam ao perfil configurado na Administração.

## Persistência e integrações

A migração `022_financeiro_orcamentario.sql` cria centros, fontes, orçamentos,
compromissos, movimentos e conciliações com RLS forçado por empresa e equipe. O
módulo pode referenciar registros de Suprimentos, Contratos e Medições sem
duplicar cadastros e mantém campos seguros para referências externas, sem
armazenar credenciais no domínio financeiro.

## Validação de encerramento

- 22 migrações aplicadas com checksums históricos preservados;
- 138 testes aprovados, sem falhas ou testes ignorados;
- teste PostgreSQL real confirmou RLS, saldo, deduções, pagamento e conciliação;
- build Vite aprovado;
- API `15.0.0`, PostgreSQL e frontend local ativos;
- interface validada em celular e desktop, sem erros de console;
- backup `prumo-20260811T151516Z.backup` verificado e restaurado no banco descartável;
- nenhuma publicação, commit, push, PR ou deploy executado nesta sprint.

## Roteiro de homologação

1. abrir `Financeiro` no menu lateral ou no menu `Mais` do celular;
2. cadastrar um centro de custo e uma fonte de recursos;
3. cadastrar a previsão anual CAPEX ou OPEX;
4. criar um compromisso manual ou vinculado a pedido/contrato;
5. reservar e comprometer o valor;
6. liquidar parcialmente, informando retenções e glosas;
7. registrar o pagamento do valor líquido e sua conciliação;
8. conferir indicadores, saldos, fluxo projetado e histórico imutável.

## Continuidade

A próxima etapa é a Sprint 16 — Obras e medições corporativas. Ela consolidará
os recursos atuais de Obras, cronograma e Medições no PostgreSQL, conectando
execução física, evidências, aceite, contratos e execução financeira.
