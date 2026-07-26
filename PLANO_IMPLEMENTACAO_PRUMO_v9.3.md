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

### Etapa 9.4 — Motor financeiro, precisão e descontos

#### Preços com precisão ampliada

- permitir o cadastro e a importação de preços unitários com mais de duas casas
  decimais;
- preservar no armazenamento a precisão original informada;
- exibir a precisão necessária no campo de edição, sem limitar o valor a duas
  casas;
- truncar, sem arredondamento, todo resultado monetário após a segunda casa
  decimal;
- centralizar a regra em uma única função monetária para evitar resultados
  diferentes entre itens, totais, revisões, exportações e relatórios.

A operação de truncamento seguirá a regra:

`truncar2(valor) = sinal(valor) × piso(valor absoluto × 100) ÷ 100`

O subtotal bruto de cada serviço será:

`truncar2(quantidade × preço unitário com precisão original)`

#### Desconto do orçamento

- permitir informar o desconto global como percentual ou como valor monetário;
- quando informado um valor, calcular o percentual equivalente sobre o subtotal
  bruto elegível do orçamento;
- aplicar o percentual individualmente a cada serviço, sem aplicar desconto
  diretamente aos grupos da EAP;
- calcular o desconto de cada serviço com truncamento em duas casas;
- apresentar, por serviço, valor bruto, desconto e valor líquido;
- registrar no histórico o tipo informado, valor original, percentual calculado,
  usuário e data da alteração;
- recalcular a distribuição quando itens, quantidades ou preços forem alterados;
- não permitir desconto negativo nem superior ao subtotal elegível.

Para desconto informado em valor:

`percentual = valor do desconto ÷ subtotal bruto elegível × 100`

`desconto do serviço = truncar2(subtotal bruto do serviço × percentual ÷ 100)`

Como o truncamento item a item pode produzir diferença de centavos, o motor
deverá controlar o resíduo e distribuí-lo em centavos entre os serviços
elegíveis, sem exceder o desconto de nenhum item, até que a soma dos descontos
coincida com o valor global informado.

#### Ordem de cálculo proposta

1. calcular e truncar o subtotal bruto de cada serviço;
2. calcular e distribuir o desconto;
3. calcular o subtotal líquido;
4. aplicar o BDI sobre o subtotal líquido;
5. truncar cada resultado monetário intermediário e final.

#### Critérios de aceite

- um preço como `12,34567` permanece armazenado com essa precisão;
- quantidade `3` e preço `12,34567` produzem subtotal bruto de `37,03`;
- desconto percentual e desconto em valor geram a mesma distribuição quando
  matematicamente equivalentes;
- a soma dos descontos dos serviços corresponde ao desconto global informado;
- revisões antigas preservam os valores e a regra de cálculo vigente na época;
- interface, exportações e impressão apresentam resultados monetários com duas
  casas, embora o preço unitário possa apresentar precisão ampliada;
- nenhum cálculo monetário usa arredondamento convencional.

### Integração futura do SINAPI

Quando a CAIXA disponibilizar uma interface estruturada ou API pública estável,
o importador de arquivos poderá ser substituído por um conector automático sem
alterar o modelo interno de bases e referências.
