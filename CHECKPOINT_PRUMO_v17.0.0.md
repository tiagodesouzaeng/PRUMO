# Checkpoint PRUMO v17.0.0

- Sprints: 16 — Obras e medições corporativas; 17 — Manutenção e facilities;
- branch local: `codex/prumo-v10.3.0`;
- migrações: `023_obras_medicoes_corporativas.sql`,
  `024_manutencao_facilities.sql` e `025_fechamento_tecnico_sprints_16_17.sql`;
- banco: PostgreSQL com 25 migrações e RLS forçado;
- validação: 143 testes aprovados e build Vite aprovado;
- backup: `prumo-20260811T171147Z.backup`, SHA-256
  `7f70dad6d8e682efcf0c8a00ca6c4ffa9175c98767536dde33b571b824569882`,
  restaurado em `prumo_restauracao_teste`;
- publicação: não realizada;
- próxima etapa: Sprint 18 — Convênios, transferências e prestação de contas.

Consulte `docs/SPRINT_16.md` e `docs/SPRINT_17.md` para escopo, governança e
roteiros de homologação.
