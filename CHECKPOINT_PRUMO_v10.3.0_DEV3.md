# Checkpoint PRUMO v10.3.0 DEV3

Data: 30/07/2026

## Plataforma multimódulo

- catálogo único compartilhado entre frontend e backend;
- Obras, Orçamentos, Bases de Preços, Suprimentos, Medições, Manutenção, PPCI,
  Utilidades, GED, Relatórios e Administração;
- módulos liberados conforme perfil e configuração da empresa;
- permissões corporativas por ação;
- catálogo visível na Administração.

## Núcleo corporativo

- unidades organizacionais hierárquicas;
- empreendimentos compartilhados entre módulos;
- segregação por empresa e equipe;
- criação idempotente;
- eventos de domínio para integrações futuras.

## Revisões

- persistência corporativa prevista;
- número único por orçamento;
- tipos original, revisão, aditivo e supressão;
- impacto financeiro e de prazo;
- snapshot de dados;
- evento emitido na criação.

## Medições

- vínculo obrigatório com orçamento;
- revisão opcional, mas pertencente ao mesmo orçamento;
- valores bruto, retenções, multas e líquido;
- bloqueio quando deduções superarem o bruto;
- período de medição validado;
- número único por orçamento;
- evento emitido na criação.

## PostgreSQL

- segunda migração executável;
- módulos, permissões e personalizações por empresa;
- empreendimentos, revisões, medições e eventos;
- `FORCE ROW LEVEL SECURITY` nas entidades privadas;
- chave transacional para serializar operações idempotentes.

## Validação

- API DEV3 iniciada localmente;
- rota de módulos consultada;
- empreendimento criado pela API real em memória;
- testes automatizados de módulos, permissões, revisões e medições;
- build do frontend mantido.

## Limitação verificada

Este notebook não possui Docker, Podman, PostgreSQL, `psql` ou `pg_isready`.
Por isso, as migrações foram validadas estruturalmente e pela camada de acesso,
mas ainda não foram executadas contra um servidor PostgreSQL real.

## Backlog

Nenhum item adicional foi aplicado nesta entrega. O BL-004 continua aguardando
o catálogo corporativo de bases e os workers, que são a próxima fundação
necessária para uma implementação definitiva.

## Publicação

Nenhuma publicação no GitHub ou Netlify integra este checkpoint.
