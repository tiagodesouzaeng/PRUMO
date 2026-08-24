# Checkpoint PRUMO v26.1.0

## Estado

- Sprints 26 e 26.1 implementadas localmente;
- acesso obrigatório antes do carregamento da aplicação;
- autenticação corporativa OIDC/JWT preservada;
- contingência administrativa local assinada, curta e revogável;
- nenhuma senha em texto simples no código, nos testes ou na documentação;
- módulos correlatos consolidados na navegação e no catálogo;
- migração `030_acesso_e_consolidacao_modular_v26.sql` aplicada localmente;
- versão pública anterior não alterada por este checkpoint.

## Requisito antes de produção

Configurar e validar o provedor OIDC com MFA, domínio HTTPS, API, PostgreSQL e
armazenamento corporativos. A contingência local deve permanecer desativada em
produção, exceto se houver procedimento formal de cofre, rotação, auditoria e
recuperação aprovado pela organização.
