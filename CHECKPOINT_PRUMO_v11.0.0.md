# Checkpoint PRUMO v11.0.0

Data local: 09/08/2026.

## Estado validado

- Sprint 11 concluída localmente e aguardando homologação;
- branch `codex/prumo-v10.3.0` preservada;
- baseline remoto anterior permanece no commit
  `5394449162d46e8c6feb26fd886146678db6eb8f` e no PR rascunho nº 2;
- alterações das Sprints 10 e 11 mantidas sem novo commit, push, PR ou deploy;
- versão local e API `11.0.0`;
- 16 migrações aplicadas com checksum;
- 109 testes aprovados, inclusive os testes reais de PostgreSQL;
- build Vite aprovado, com aviso não bloqueante de tamanho dos bundles.

## Sprint 11

- módulo Patrimônio e Espaços habilitado no catálogo e na navegação;
- hierarquia obrigatória `Cliente > Site > Prédio > Sala`;
- dados de identificação, endereço, área, ocupação, responsável e situação;
- ativos/equipamentos vinculados somente a salas ativas;
- movimentações imutáveis e auditadas entre salas;
- controle de versão para unidades e ativos;
- desativação protegida quando houver descendentes ou ativos em operação;
- RLS forçado por empresa e equipe;
- permissões separadas para consulta, edição e movimentação;
- empreendimentos podem referenciar uma unidade patrimonial validada;
- GED aceita vínculos com entidades patrimoniais.

## Recuperação

- backup final: `outputs/backups/prumo-20260809T193547Z.backup`;
- SHA-256: `0c26fa7996b2b1e89c7a17b525d447c82fcb1270f37af32a88f09de71618b04e`;
- formato PostgreSQL custom verificado estruturalmente;
- restauração aprovada em `prumo_restauracao_teste`;
- banco restaurado confirmou 16 migrações e as tabelas de unidades, ativos e
  movimentações patrimoniais.

## Riscos e continuidade

- partes dos módulos legados ainda dependem de `localStorage` e IndexedDB até a
  migração assistida já prevista;
- OIDC e armazenamento físico dos binários do GED continuam pendências de
  infraestrutura de produção;
- o módulo Obras ainda possui uma tela demonstrativa legada, embora sua API já
  aceite a referência patrimonial canônica;
- próxima etapa: Sprint 12 — Demandas e Carteira de Investimentos.
