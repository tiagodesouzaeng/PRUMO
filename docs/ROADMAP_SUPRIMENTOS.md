# Roadmap — Relatório de suprimentos

## Objetivo

Transformar o orçamento e o cronograma em um plano de compras que informe o insumo, a quantidade, a data necessária e a data recomendada para aquisição, reduzindo estoque desnecessário no canteiro.

## Entregas previstas

1. **Explosão recursiva das composições**
   - decompor serviços e composições próprias até chegar aos insumos finais;
   - preservar base, estado, competência, coeficiente e preço usados em cada nível;
   - impedir ciclos entre composições e sinalizar referências incompletas.

2. **Demanda consolidada**
   - multiplicar coeficientes pelas quantidades do orçamento;
   - agrupar insumos equivalentes por código, unidade e base;
   - permitir regras de equivalência e perdas técnicas.

3. **Integração com o cronograma**
   - distribuir a demanda conforme a execução mensal dos serviços;
   - permitir prazo de antecedência configurável em dias por classe de material ou fornecedor;
   - calcular a data de compra a partir da data prevista de consumo.

4. **Controle de cobertura**
   - considerar estoque disponível, pedidos emitidos e entregas programadas;
   - calcular `necessidade de compra = demanda prevista − estoque disponível − saldo de pedidos`;
   - indicar faltas, excessos e risco de ruptura por período.

5. **Relatórios**
   - lista completa de insumos e quantidades;
   - calendário de compras por mês, semana e data recomendada;
   - posição de estoque e quantidade faltante;
   - exportação XLSX para cotação, pedido e acompanhamento.

## Dependências

- memória recursiva das composições;
- unidades e conversões consistentes;
- cronograma físico por serviço;
- cadastro futuro de estoque, fornecedores, prazos e pedidos.

## Critérios de aceite

- todos os insumos utilizados no orçamento são rastreáveis até o serviço de origem;
- a alteração de quantidade, composição ou cronograma recalcula a demanda;
- o prazo de compra é configurável;
- o relatório diferencia necessidade, estoque, pedido e saldo faltante;
- itens sem preço ou sem composição aparecem como pendência, nunca são ignorados.
