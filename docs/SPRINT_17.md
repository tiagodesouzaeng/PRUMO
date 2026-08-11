# Sprint 17 — Manutenção e facilities

## Resultado

A Sprint 17 substitui a fila demonstrativa de Manutenção por chamados, planos
preventivos e ordens de serviço corporativas. Espaços e ativos permanecem sob o
cadastro patrimonial da Sprint 11.

Situação local: concluída na versão `17.0.0`, aguardando homologação do usuário.

## Escopo entregue

- chamados corretivos, preventivos, inspeções e melhorias;
- vínculo obrigatório com local patrimonial e opcional com ativo;
- prioridade crítica, alta, média ou baixa;
- SLA inicial de 4, 12, 48 ou 120 horas conforme a prioridade;
- triagem, programação, atendimento, solução, reabertura, aceite e cancelamento;
- planos preventivos por espaço ou ativo, periodicidade e próxima execução;
- ordens de serviço com equipe, fornecedor, programação e diagnóstico;
- recursos separados em material, mão de obra, equipamento e serviço;
- custo calculado pela quantidade e valor unitário;
- painel de criticidade, violação de SLA, preventivas, custos e conclusões.

## Governança

As permissões distinguem consulta, abertura, planejamento preventivo,
atendimento e encerramento. Chamados e ordens usam idempotência, versão e
auditoria. Recursos consumidos e decisões são históricos imutáveis.

Fluxo principal:

`Aberto > Triado/Programado > Em atendimento > Resolvido > Fechado`

Resolver, fechar e cancelar exigem justificativa. O fechamento representa o
aceite do serviço pelo responsável autorizado.

## Persistência

A migração `024_manutencao_facilities.sql` cria planos, chamados, ordens,
recursos e decisões. A migração `025_fechamento_tecnico_sprints_16_17.sql`
restringe a limpeza técnica a organizações de teste. Todas as tabelas possuem
RLS forçado por empresa e equipe.

## Validação de encerramento

- 25 migrações aplicadas com checksums históricos preservados;
- 143 testes automatizados, incluindo PostgreSQL real e isolamento por equipe;
- build Vite aprovado;
- backup `prumo-20260811T171147Z.backup` verificado e restaurado no banco
  descartável `prumo_restauracao_teste`;
- API e interface preparadas para validação local.

## Roteiro de homologação

1. abrir `Manutenção` e cadastrar um plano preventivo para um ativo;
2. abrir um chamado crítico ou alto e conferir o prazo de SLA;
3. triar, definir responsável e iniciar o atendimento;
4. emitir uma ordem e lançar material, mão de obra ou serviço;
5. resolver o chamado, registrar o aceite e conferir o custo consolidado.

## Continuidade

A próxima etapa é a Sprint 18 — Convênios, transferências e prestação de contas.
