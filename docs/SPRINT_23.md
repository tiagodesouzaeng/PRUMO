# Sprint 23 — Piloto controlado e produção

## Resultado

A fundação técnica do piloto foi concluída na versão 23.0.0.

- OIDC/JWT continua obrigatório quando a API executa em produção;
- PostgreSQL continua obrigatório em produção, com isolamento RLS;
- o GED passou a enviar e baixar arquivos por URLs S3 temporárias;
- as chaves de objetos são segregadas por organização e documento;
- o navegador calcula SHA-256 antes do envio e a versão imutável registra o hash;
- a API oferece /health para vivacidade e /ready para prontidão;
- Administração exibe API, banco, identidade e storage sem revelar segredos;
- respostas da API e o frontend publicado receberam cabeçalhos de segurança;
- o comando pnpm production:check valida as condições mínimas de promoção;
- o Netlify recebeu configuração reproduzível de build, SPA, cache e segurança;
- o piloto, treinamento, retorno e critérios de entrada estão documentados.

## Arquivos do GED

O frontend nunca recebe credenciais do storage. A API assina uma autorização
curta para um único objeto; o upload ocorre diretamente no provedor S3
compatível. A versão só é registrada depois que o storage confirma o envio.
Downloads usam outra URL temporária e a API recusa referências que não pertençam
ao prefixo da organização ativa.

O bucket deve configurar CORS apenas para as origens públicas autorizadas,
métodos PUT, GET e HEAD, e cabeçalho Content-Type.

## Prontidão e operação

- GET /health: informa se o processo e o banco respondem;
- GET /ready: bloqueia a promoção quando um componente obrigatório falha;
- GET /v1/operacao/prontidao: visão administrativa autenticada;
- logs incluem identificador de requisição retornado em X-Request-Id;
- fila e integrações continuam disponíveis na observabilidade autenticada.

## Validação

- 165 testes automatizados aprovados;
- isolamento de upload entre organizações coberto por teste;
- storage obrigatório coberto por readiness com resposta 503;
- build e auditoria de dependências fazem parte do fechamento;
- nenhuma credencial ou URL assinada é persistida no repositório.

## Limites da publicação

O deploy do frontend não substitui a hospedagem da API. Para um piloto público
funcional ainda é necessário fornecer os serviços externos e suas variáveis:
provedor OIDC, API HTTPS, PostgreSQL gerenciado, bucket S3 compatível e
monitoramento externo. Esses valores não pertencem ao código-fonte.
