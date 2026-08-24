# Backup e restauração do PostgreSQL

Este procedimento atende ao critério de recuperação da Sprint 10.4 sem reduzir
o isolamento multiempresa do PRUMO.

## Regras de segurança

- não conceder `BYPASSRLS` às roles `prumo_api` ou `prumo_migrator`;
- usar uma role operacional exclusiva para backup, com credencial guardada fora
  do repositório e disponibilizada apenas durante a operação;
- nunca usar o banco `prumo` como destino de um teste de restauração;
- o banco de ensaio deve terminar em `_restore_test` ou
  `_restauracao_teste`;
- não versionar arquivos `.backup`, manifestos ou URLs de conexão.

## 1. Gerar uma cópia completa

Configure `PRUMO_BACKUP_DATABASE_URL` somente na sessão operacional. A URL deve
usar a role exclusiva de backup. Opcionalmente, configure `PRUMO_BACKUP_DIR`.

No computador local, a preparação pode ser feita por:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\configurar-backup-postgresql.ps1
```

O configurador solicita a senha administrativa numa janela segura, cria a role
dedicada `prumo_backup`, prepara o banco descartável
`prumo_restauracao_teste` e salva apenas as URLs operacionais no ambiente do
usuário. A senha administrativa não é gravada.

```powershell
pnpm db:backup
```

O comando cria um arquivo no formato custom do PostgreSQL e um manifesto com
tamanho e SHA-256. Uma falha durante a geração deixa o arquivo marcado como
`.partial`, que não pode ser usado como cópia válida.

## 2. Verificar a cópia

```powershell
pnpm db:backup:verify
```

O verificador confirma a estrutura esperada e compara o SHA-256 quando existe
um manifesto. Para escolher um arquivo específico, configure
`PRUMO_BACKUP_FILE` com seu caminho absoluto.

## 3. Ensaiar a restauração

Crie previamente um banco descartável vazio. Configure:

- `PRUMO_RESTORE_TEST_DATABASE_URL` apontando para o banco descartável;
- `PRUMO_RESTORE_TEST_CONFIRM=RECRIAR_BANCO_DE_TESTE`;
- `PRUMO_BACKUP_FILE` se a cópia mais recente não for a desejada.

```powershell
pnpm db:restore:test
```

O comando limpa somente o banco explicitamente informado, restaura a cópia e
confirma a tabela de migrações e a estrutura de auditoria. Registre a data e o
resultado no painel Administração > Auditoria.

## Situação local em 9 de agosto de 2026

- a cópia de referência `prumo-baseline-20260807-184113.backup` passou na
  verificação estrutural e tem SHA-256
  `21a077954e6b2de3da2e1b912c929f6fa572d938558265709a3423c6291255`;
- a tentativa histórica com `prumo_migrator` foi recusada pelo `FORCE RLS`,
  como esperado, e o arquivo incompleto permanece marcado como `.partial`;
- a role exclusiva `prumo_backup` foi criada sem alterar os privilégios da API
  ou da migração;
- a cópia `prumo-20260809T124320Z.backup`, posterior às migrações 005–007, foi
  validada com SHA-256
  `a930d9a268f29c946d0e7f40e469f9b349a7bc8c94434589658af59623d3d920`;
- a restauração integral foi aprovada no banco descartável
  `prumo_restauracao_teste` e registrada na política corporativa.
