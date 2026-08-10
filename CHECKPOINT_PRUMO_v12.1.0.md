# Checkpoint PRUMO v12.1.0

Data local: 10/08/2026.

## Estado validado

- Sprint 12.1 de consolidação administrativa concluída localmente;
- branch `codex/prumo-v10.3.0` preservada;
- alterações mantidas sem novo commit, push, PR ou deploy;
- versão local e API `12.1.0`;
- 19 migrações preservadas com checksum, sem mudança de banco nesta etapa;
- 122 testes aprovados, sem falhas ou testes ignorados;
- build Vite aprovado, com aviso não bloqueante de tamanho dos bundles;
- API PostgreSQL e frontend local preparados para homologação.

## Consolidação administrativa

- sete áreas administrativas produtivas e conectadas a contratos reais;
- visão operacional alimentada pela API, sem indicadores fictícios;
- catálogo de módulos, capacidades e dependências visível;
- matriz de perfis e permissões derivada da fonte canônica da plataforma;
- conectores apresentados conforme a capacidade atual do worker;
- cadastros demonstrativos e botões sem implementação removidos da navegação;
- fronteira explícita entre governança administrativa e operação dos módulos.

## Banco e recuperação

Não houve migração nem transformação de dados na versão `12.1.0`. O backup final
validado na Sprint 12 permanece a referência de recuperação:

- arquivo: `outputs/backups/prumo-20260809T225130Z.backup`;
- SHA-256: `c6b6970ca9aeca158a05005a70a3afab019d2e0e1482df81bd86553d7388a3cd`;
- restauração anteriormente aprovada em `prumo_restauracao_teste`.

## Pendências antes da administração plena

- OIDC e CRUD administrativo real de usuários, equipes e associações;
- manutenção real de organizações e equipes;
- adaptadores de integração que obtenham e importem dados no servidor;
- capacidades detalhadas para os módulos legados;
- parâmetros organizacionais versionados e auditados;
- remoção posterior de componentes estáticos antigos já inacessíveis.

## Continuidade

A próxima etapa permanece a Sprint 13 — Suprimentos e Contratações, condicionada
à homologação local da consolidação administrativa.
