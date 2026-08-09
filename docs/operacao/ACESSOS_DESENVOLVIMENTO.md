# Acessos locais de desenvolvimento

O ambiente local do PRUMO separa as identidades PostgreSQL por responsabilidade.

| Role | Finalidade | SUPERUSER | CREATEDB | CREATEROLE | BYPASSRLS |
|---|---|---:|---:|---:|---:|
| `prumo_api` | execução da API | não | não | não | não |
| `prumo_migrator` | migrações e propriedade das tabelas | não | não | não | não |
| `prumo_backup` | cópia integral operacional | não | não | não | sim |
| `prumo_devops` | criar bancos e roles de desenvolvimento | não | sim | sim | não |

`prumo_devops` não substitui as outras identidades e não deve ser usado pela
API. A separação preserva o RLS durante o desenvolvimento autônomo.

As URLs ficam no ambiente do usuário do Windows, nunca no repositório:

- `PRUMO_DATABASE_URL`;
- `PRUMO_MIGRATION_DATABASE_URL`;
- `PRUMO_BACKUP_DATABASE_URL`;
- `PRUMO_RESTORE_TEST_DATABASE_URL`;
- `PRUMO_ADMIN_DATABASE_URL`.

Para configurar ou rotacionar apenas a conta operacional:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\configurar-automacao-postgresql.ps1
```

A senha administrativa do PostgreSQL é solicitada somente para criar ou
rotacionar `prumo_devops`; ela não é armazenada. Depois disso, criação de bancos
descartáveis, roles comuns, migrações, testes, backup e restauração usam as
credenciais operacionais separadas.

## Git local

- identidade: `Tiago Souza`;
- e-mail privado do GitHub: `309209126+tiagodesouzaeng@users.noreply.github.com`;
- credenciais HTTPS: Git Credential Manager;
- branch padrão para repositórios novos: `main`;
- referências remotas removidas automaticamente quando deixam de existir;
- conversões inseguras de final de linha geram alerta.

A configuração não autoriza commit, push, PR ou deploy. Essas ações continuam
dependendo de autorização expressa.
