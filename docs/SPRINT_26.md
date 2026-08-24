# Sprint 26 — Acesso seguro e contingência

## Resultado

O PRUMO passa a exigir uma sessão válida antes de carregar os dados e módulos da
aplicação.

- tela de acesso desacoplada da área autenticada;
- tokens locais assinados, de curta duração e mantidos apenas na sessão do
  navegador;
- encerramento de sessão com revogação do token;
- limite de tentativas por origem e mensagens que não revelam qual credencial
  falhou;
- conta administrativa local de contingência configurada exclusivamente no
  ambiente ignorado pelo Git;
- senha de contingência armazenada somente como derivação criptográfica com sal;
- autenticação OIDC/JWT corporativa preservada como requisito de produção.

## Limites operacionais

A conta local é um recurso de recuperação para desenvolvimento e homologação.
Ela não substitui o provedor corporativo, MFA, gestão centralizada do ciclo de
vida das identidades ou a aprovação do ambiente de produção. O provedor OIDC e
o endereço do gateway de acesso ainda precisam ser configurados na implantação.
