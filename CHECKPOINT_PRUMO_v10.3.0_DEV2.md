# Checkpoint PRUMO v10.3.0 DEV2

Data: 30/07/2026

## API executável

- servidor Fastify;
- rota pública de saúde;
- rotas corporativas versionadas em `/v1`;
- CORS configurável;
- erros estruturados por código;
- validação dos contratos de entrada.

## Autenticação

- verificação OIDC/JWT preparada por issuer, audience e JWKS;
- token recebido apenas em memória;
- identidade temporária de desenvolvimento explicitamente habilitada;
- produção bloqueada quando OIDC não estiver configurado.

## PostgreSQL e isolamento

- adaptador com pool de conexões;
- uma transação por operação;
- vínculo validado antes da ativação do tenant;
- empresa e equipe configuradas somente dentro da transação;
- `FORCE ROW LEVEL SECURITY`;
- role da API prevista sem `BYPASSRLS`;
- rollback quando o vínculo for recusado.

## Orçamentos corporativos

- consulta por empresa e equipe;
- criação com chave de idempotência;
- repetição da mesma criação sem duplicidade;
- versão retornada por `ETag`;
- atualização condicionada por `If-Match`;
- conflito concorrente retornado sem sobrescrever dados.

## Migrações

- primeiro esquema executável;
- empresas, equipes, vínculos, orçamentos e idempotência;
- executor ordenado;
- checksum de cada arquivo;
- bloqueio por advisory lock;
- recusa de alteração em migração já aplicada.

## Validação

- 66 testes automatizados aprovados;
- API local iniciada e rota `/health` consultada com sucesso;
- build do frontend mantido;
- nenhum banco externo ou dado real foi alterado.

## Backlog

O BL-004 não avançou para aplicação efetiva nesta entrega. A decisão foi
intencional: comparação e atualização de preços devem usar o catálogo
corporativo e os workers para não criar uma implementação local descartável.

## Limites

- PostgreSQL ainda não foi provisionado;
- migração SQL foi validada estruturalmente, mas não aplicada em banco real;
- revisões, bases, composições e medições ainda permanecem nos repositórios
  locais;
- nenhuma publicação no GitHub ou Netlify integra este checkpoint.
