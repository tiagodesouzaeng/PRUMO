# Checkpoint PRUMO v10.4.0

Data local: 9 de agosto de 2026.

## Estado validado

- branch local: `codex/prumo-v10.3.0`;
- versão do código local: `10.4.0`;
- migrações 001–007 aplicadas e verificadas;
- 93 testes aprovados, sem falhas ou testes ignorados;
- build de produção aprovado;
- API local com PostgreSQL operacional;
- nenhuma publicação, commit, push, PR ou deploy realizado.

## Entregas

- auditoria corporativa imutável, encadeada e isolada por empresa;
- consulta administrativa, filtros, exportação CSV e política de retenção;
- registro auditável do último backup e teste de restauração;
- sanitização de senhas, tokens, segredos e credenciais;
- role operacional exclusiva para backup sem ampliar as roles da API ou de
  migração;
- role `prumo_devops` para automação local, com `CREATEDB` e `CREATEROLE`, sem
  `SUPERUSER` ou `BYPASSRLS`;
- Git configurado com identidade privada e autenticação no Git Credential
  Manager para `tiagodesouzaeng`;
- navegação responsiva do orçamento;
- valores unitários de mão de obra e material separados;
- abertura de composição interna pela linha ou pelo botão dedicado.

## Recuperação PostgreSQL

- arquivo: `prumo-20260809T124320Z.backup`;
- SHA-256: `a930d9a268f29c946d0e7f40e469f9b349a7bc8c94434589658af59623d3d920`;
- formato: PostgreSQL custom;
- verificação estrutural: aprovada;
- banco descartável: `prumo_restauracao_teste`;
- restauração integral: aprovada;
- resultado registrado na política corporativa de auditoria.

## Continuidade

O próximo incremento planejado é a Sprint 10.5 — Documentos e Integrações,
iniciando pela fundação do GED, metadados, hash, versionamento e vínculo dos
documentos aos registros corporativos.
