# Plano de implementação — PRUMO v9.3

Data: 26/07/2026

## Objetivo

Integrar as publicações mensais do SINAPI ao motor orçamentário e tornar a
inclusão de serviços coerente com a estrutura da EAP.

## Referências oficiais consideradas

- Página oficial do SINAPI:
  `https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx`
- Livro SINAPI — Metodologias e Conceitos:
  `https://www.caixa.gov.br/Downloads/sinapi-metodologia/Livro_SINAPI_Metodologias_Conceitos.pdf`
- Notas técnicas:
  `https://www.caixa.gov.br/Downloads/sinapi-historico-de-encargos-e-notas/Notas_SINAPI.pdf`

## Regras confirmadas

- as publicações a partir de 2025 são distribuídas em arquivos ZIP;
- os arquivos XLSX incluem insumos e composições para todas as UFs;
- cada versão deve preservar UF, referência mensal e regime;
- referências sem preço continuam tecnicamente válidas, mas não podem atualizar
  silenciosamente valores do orçamento;
- o arquivo utilizado deve permanecer identificável por hash.

## Arquitetura

### Orçamentos

Continuam no repositório local versionado do PRUMO.

### Bases SINAPI

São armazenadas em IndexedDB, separadas dos orçamentos:

- `bases`: metadados, versão, UF, regime, contagens e hash;
- `referencias`: insumos e composições vinculados à base.

Essa separação evita o limite reduzido do localStorage e permite armazenar
milhares de referências.

## Fluxos da v9.3

1. Importar ZIP, XLSX ou XLS.
2. Informar UF, referência e regime.
3. Calcular hash e identificar preços zerados.
4. Salvar a base como versão independente.
5. Ativar uma base.
6. Buscar composição por código ou descrição.
7. Selecionar o grupo da EAP.
8. Gerar automaticamente o próximo número do serviço.
9. Incluir o serviço dentro do grupo.
10. Atualizar preços vinculados, ignorando referências zeradas.

## Homologação recomendada

- testar com uma publicação oficial completa da CAIXA;
- conferir os nomes reais das colunas de todas as abas;
- medir desempenho com o conjunto nacional completo;
- comparar amostras de preços e composições com o relatório oficial;
- validar regras específicas dos regimes desonerado e sem desoneração.

## Evolução posterior

Quando a CAIXA disponibilizar uma interface estruturada ou API pública estável,
o importador de arquivos poderá ser substituído por um conector automático sem
alterar o modelo interno de bases e referências.
