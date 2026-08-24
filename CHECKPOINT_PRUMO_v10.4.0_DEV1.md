# Checkpoint PRUMO — Sprint 10.4 DEV1

Data local: 8 de agosto de 2026.

## Estado

- branch preservada: `codex/prumo-v10.3.0`;
- versão publicada preservada: `10.3.0`;
- nenhuma publicação, commit, push, PR ou deploy realizado;
- migrações locais 005, 006 e 007 aplicadas com checksum;
- 93 testes aprovados, sem falhas ou testes ignorados;
- build de produção aprovado.

## Entregue neste incremento

- auditoria imutável e encadeada por empresa;
- consulta, filtros, exportação CSV e política administrativa;
- sanitização de dados sensíveis;
- ferramentas seguras para backup, verificação e ensaio de restauração;
- barra de módulos responsiva;
- mão de obra e material exibidos separadamente no orçamento;
- linha de composição filha clicável, além do botão `Abrir`.

## Bloqueio para promover a v10.4.0

O ensaio integral de recuperação depende de uma credencial operacional de
backup e de um banco descartável dedicado. O `FORCE RLS` foi mantido; as roles
da API e de migração não foram ampliadas para contornar essa proteção.

Depois de configurar essas duas peças, execute os três comandos descritos em
`docs/operacao/BACKUP_RESTAURACAO_POSTGRESQL.md`, registre o resultado e repita
os testes antes de promover a versão.
