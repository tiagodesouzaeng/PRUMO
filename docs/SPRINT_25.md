# Sprint 25 — Migração definitiva e piloto assistido

## Resultado

O ciclo de homologação e promoção passou a ser governado pelo PRUMO.

- checklist por organização cobre massa de homologação, RLS, inventário local,
  lotes, transição dos repositórios, fluxos críticos, retorno e aceite;
- requisitos aprovados exigem uma evidência explícita;
- início do piloto é bloqueado até a aprovação integral da Sprint 24;
- aprovação e encerramento são bloqueados até a conclusão da Sprint 25;
- suspensão e retomada preservam o histórico de decisões;
- alterações e decisões entram na trilha imutável da Auditoria;
- o estado fica persistido no PostgreSQL por organização;
- modo híbrido continua disponível como retorno seguro.

## Critério de encerramento operacional

A implementação da Sprint está concluída, mas cada organização somente poderá
ser promovida quando seu próprio checklist apresentar 100% de aprovação e zero
bloqueador. Dados locais e IndexedDB não devem ser removidos antes desse aceite.

