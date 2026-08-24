# Checkpoint PRUMO v12.0.0

Data local: 09/08/2026.

## Estado validado

- Sprint 12 concluída localmente e aguardando homologação;
- branch `codex/prumo-v10.3.0` preservada;
- baseline remoto anterior permanece no commit
  `5394449162d46e8c6feb26fd886146678db6eb8f` e no PR rascunho nº 2;
- alterações das Sprints 10, 11 e 12 mantidas sem novo commit, push, PR ou deploy;
- versão local e API `12.0.0`;
- 19 migrações aplicadas com checksum;
- 120 testes aprovados, inclusive todos os testes reais de PostgreSQL;
- build Vite aprovado, com aviso não bloqueante de tamanho dos bundles;
- API PostgreSQL e frontend local mantidos ativos para homologação.

## Sprint 12

- módulo Demandas e Investimentos habilitado no catálogo e na navegação;
- programas estratégicos com período e limite financeiro;
- demandas vinculadas à hierarquia `Cliente > Site > Prédio > Sala`;
- pontuação ponderada de urgência, impacto, risco e alinhamento;
- análise, priorização, aprovação, rejeição, reabertura e incorporação;
- decisões imutáveis e auditadas;
- carteiras anuais com limite, ordem e valor planejado;
- idempotência e controle de versão nas operações críticas;
- RLS forçado por empresa e equipe;
- permissões separadas para consulta, edição, priorização e aprovação;
- interface responsiva com indicadores, filtros, modal e linha do tempo.

## Recuperação

- backup final: `outputs/backups/prumo-20260809T225130Z.backup`;
- SHA-256: `c6b6970ca9aeca158a05005a70a3afab019d2e0e1482df81bd86553d7388a3cd`;
- formato PostgreSQL custom verificado estruturalmente;
- restauração aprovada em `prumo_restauracao_teste`;
- banco restaurado confirmou as 19 migrações e a estrutura de auditoria.

## Correção de compatibilidade

A validação no navegador detectou que a migração inicial do Planejamento podia
transformar organizações com catálogo implícito em uma lista contendo somente o
novo módulo. A migração 019 preserva a política anterior de todos os módulos
ativos. Após a correção, Patrimônio, Demandas e os demais módulos voltaram a ser
exibidos e a tela carregou sem erro.

## Riscos e continuidade

- partes dos módulos legados ainda dependem de `localStorage` e IndexedDB até a
  migração assistida prevista;
- OIDC e armazenamento físico dos binários do GED continuam pendências de
  infraestrutura de produção;
- o módulo Obras ainda possui tela demonstrativa legada, embora sua API já use
  a referência patrimonial canônica;
- próxima etapa: Sprint 13 — Suprimentos e Contratações.
