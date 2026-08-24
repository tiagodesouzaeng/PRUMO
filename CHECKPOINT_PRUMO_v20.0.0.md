# Checkpoint PRUMO v20.0.0

- sprints: 18 — Convênios e prestação de contas; 19 — Regularidade, compliance e transparência; 20 — BI, portais e consolidação;
- branch local: `codex/prumo-v10.3.0`;
- migrações: `026_convenios_prestacao_contas.sql`, `027_regularidade_compliance_transparencia.sql` e `028_bi_portais_consolidacao.sql`;
- banco: PostgreSQL com 28 migrações, checksums e RLS forçado;
- validação: 153 testes aprovados, incluindo PostgreSQL real, além do build Vite;
- backup: `outputs/backups/prumo-20260811T174408Z.backup`, SHA-256
  `14d2f7aac7748237b63f99fe645ece9a57f69b7d155ba7e3aee902bdf08fc83e`,
  verificado e restaurado no banco descartável `prumo_restauracao_teste`;
- segurança: permissões segregadas, auditoria, idempotência, versão, token de portal em hash e segredos referenciados;
- publicação: não realizada; a versão permanece local para homologação;
- próxima fase: homologação integrada, correções de aceitação e prontidão de produção.

Consulte `docs/SPRINT_18.md`, `docs/SPRINT_19.md` e `docs/SPRINT_20.md`.
