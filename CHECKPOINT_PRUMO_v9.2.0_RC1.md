# Checkpoint — PRUMO v9.2.0 RC1

Data: 26/07/2026

## Estado

O módulo de Orçamentos possui motor editável de EAP, cálculo detalhado de
BDI, composições próprias, importação de planilhas, validações e comparação
entre revisões.

## Entregas

- criação e edição de grupos e serviços;
- exclusão hierárquica de grupos;
- duplicação e ordenação de itens;
- cálculo de grupos pela EAP;
- BDI detalhado por componentes;
- memória de cálculo do BDI;
- composições próprias por orçamento;
- importação CSV, XLS e XLSX;
- validações de integridade;
- snapshots e comparação de revisões;
- migração compatível dos dados da v9.1;
- remoção das referências fixas à ULBRA.

## Validações executadas

- build de produção;
- cálculo do BDI;
- validação de planilha;
- comparação de snapshots;
- leitura de arquivo tabular;
- navegação e formulários no navegador;
- auditoria textual da marca.

## Próxima evolução recomendada

1. Integração automática das publicações SINAPI.
2. API e banco relacional compartilhado.
3. Autenticação, permissões e auditoria.
4. Cronograma e medições vinculados à EAP.
5. Testes automatizados permanentes.
