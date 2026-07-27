# Plano de implementação — PRUMO v9.4

Data: 26/07/2026

## Objetivo

Consolidar uma regra financeira única para preços com precisão ampliada,
truncamento monetário, desconto global e aplicação do BDI.

## Regras implementadas

### Precisão

- preço unitário armazenado com a precisão original disponível;
- campos de preço aceitam mais de duas casas decimais;
- subtotal de cada serviço truncado após a segunda casa;
- valores monetários intermediários e finais truncados, sem arredondamento;
- regra identificada como `9.4-truncamento-2-casas`.

### Desconto

- entrada em percentual ou valor monetário;
- percentual calculado automaticamente para desconto informado em valor;
- rateio proporcional entre os serviços elegíveis;
- distribuição do resíduo pelo método dos maiores restos;
- soma dos descontos individuais igual ao desconto global;
- grupos da EAP apenas consolidam os descontos de seus serviços;
- limites entre zero e o subtotal bruto elegível.

### Ordem financeira

1. subtotal bruto dos serviços;
2. desconto distribuído;
3. custo direto líquido;
4. BDI sobre o custo direto líquido;
5. preço total.

## Rastreabilidade

- configuração atual armazenada em `descontoGlobal`;
- alterações registradas em `historicoCalculo`;
- novas revisões preservam configuração, versão da regra e totais;
- exportação JSON inclui automaticamente os dados financeiros.

## Interface

- cartão de condição comercial na planilha;
- simulação imediata antes de aplicar;
- colunas de bruto, desconto e total líquido;
- preço unitário exibido com até oito casas decimais;
- memória do BDI apresenta subtotal bruto, desconto e custo líquido.

## Critérios de aceite

- `3 × 12,34567` resulta em `37,03`;
- nenhum resultado monetário usa arredondamento convencional;
- desconto em valor fecha exatamente após o rateio;
- desconto percentual respeita o subtotal elegível;
- BDI incide somente depois do desconto;
- remover o desconto restaura os totais sem alterar os itens;
- dados permanecem após recarregar a aplicação.
