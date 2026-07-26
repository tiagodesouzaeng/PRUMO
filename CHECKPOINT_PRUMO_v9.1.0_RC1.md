# Checkpoint — PRUMO v9.1.0 RC1

Data: 26/07/2026

## Estado

O módulo de Orçamentos deixou de depender apenas de dados fixos e passou a
operar com um modelo versionado persistido no navegador.

## Entregas concluídas

- repositório local com controle de versão do esquema;
- múltiplos orçamentos persistentes;
- seleção do orçamento ativo preservada;
- criação de orçamento;
- inclusão e exclusão de serviços;
- cálculo automático de custo direto, BDI, total e valor por área;
- consolidação de grupos por código EAP;
- indicador de pendências;
- criação de revisões;
- exportação JSON;
- formulários responsivos e acessíveis.

## Validação

- testes funcionais no navegador: criação, inclusão, cálculo e recarga;
- teste isolado das funções de cálculo;
- build de produção com 141 módulos.

## Próxima evolução recomendada

1. Implantar uma API e um banco relacional compartilhado.
2. Adicionar edição de itens e grupos da EAP.
3. Conectar a importação oficial SINAPI e suas versões.
4. Implementar autenticação, permissões e auditoria.
5. Criar testes automatizados permanentes.
