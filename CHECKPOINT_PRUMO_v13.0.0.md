# Checkpoint PRUMO v13.0.0

Data local: 10/08/2026.

## Estado validado

- Sprint 13 concluída localmente e aguardando homologação;
- branch `codex/prumo-v10.3.0` preservada;
- alterações mantidas sem novo commit, push, PR ou deploy;
- versão local e API `13.0.0`;
- 20 migrações aplicadas com checksum;
- 127 testes aprovados, inclusive integração real PostgreSQL;
- build Vite aprovado, com aviso não bloqueante de tamanho dos bundles;
- API PostgreSQL e frontend local ativos.

## Entrega funcional

- módulo Suprimentos disponível na navegação e no catálogo modular;
- fornecedores compartilhados e qualificados;
- processos vinculados a demanda incorporada ou orçamento;
- estudo técnico, riscos, termo de referência e critérios de julgamento;
- pesquisa de preços, propostas, seleção e aprovação;
- pedidos, recebimentos, saldo e aceite;
- idempotência, controle de versão, decisões imutáveis e auditoria;
- RLS por empresa e equipe e permissões segregadas.

## Banco e recuperação

- backup final: `outputs/backups/prumo-20260810T161111Z.backup`;
- SHA-256: `dc0fb8c0b401d5b7a5d3b0c7a86d50f4273a02031b74e96441449bf541ba5ff1`;
- formato PostgreSQL custom verificado estruturalmente;
- restauração aprovada em `prumo_restauracao_teste`;
- banco restaurado confirmou as 20 migrações e a estrutura de auditoria.

## Continuidade

A próxima etapa é a Sprint 14 — Contratos, condicionada à homologação local da
versão `13.0.0`.
