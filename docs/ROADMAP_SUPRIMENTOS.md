# Roadmap — Relatório de suprimentos

## Objetivo

Transformar o orçamento e o cronograma em um plano de compras que informe o insumo, a quantidade, a data necessária e a data recomendada para aquisição, reduzindo estoque desnecessário no canteiro.

## Entregas previstas

1. **Explosão recursiva das composições — concluída na v9.7.0 RC1**
   - decompor serviços e composições próprias até chegar aos insumos finais;
   - preservar base, estado, competência, coeficiente e preço usados em cada nível;
   - impedir ciclos entre composições e sinalizar referências incompletas.

2. **Demanda consolidada — concluída na v9.11.0 RC1**
   - multiplicar coeficientes pelas quantidades do orçamento;
   - agrupar insumos equivalentes por código, unidade e base;
   - permitir fator de conversão, unidade de destino e perdas técnicas;
   - registrar substituição por código, descrição, base e preço equivalente;
   - exigir justificativa técnica e manter a rastreabilidade da referência original.

3. **Integração com o cronograma — concluída na v9.9.0 RC1**
   - distribuir a demanda conforme a execução mensal dos serviços;
   - permitir prazo de antecedência padrão e ajuste configurável por insumo;
   - calcular a data de compra a partir da data prevista de consumo.

4. **Controle de cobertura — concluído na v9.10.0 RC1**
   - considerar estoque disponível, pedidos emitidos e entregas programadas;
   - calcular `necessidade de compra = demanda prevista − estoque disponível − saldo de pedidos`;
   - indicar faltas, excessos e risco de ruptura por período.

5. **Relatórios — concluídos na v9.11.0 RC1**
   - lista completa de insumos e quantidades;
   - calendário de compras por mês, semana e data recomendada;
   - posição de estoque e quantidade faltante;
   - exportação XLSX para cotação, pedido e acompanhamento.
   - arquivo único com abas Resumo, Demanda, Calendário, Cobertura, Cotação,
     Pedidos e Pendências;
   - fórmulas, proteção das células e campos editáveis identificados.

6. **Homologação do usuário — pendente**
   - validar os cálculos com orçamentos e composições reais;
   - conferir conversões, perdas e equivalências aprovadas pela equipe técnica;
   - abrir o relatório no Excel e registrar as ressalvas no relatório de
     validação apresentado no chat.

## Dependências

- memória recursiva das composições;
- unidades e conversões consistentes;
- cronograma físico por serviço;
- cadastro corporativo futuro de estoque e fornecedores; nesta etapa, estoque,
  prazos e pedidos são controlados dentro da revisão do orçamento.

## Critérios de aceite

- todos os insumos utilizados no orçamento são rastreáveis até o serviço de origem;
- a alteração de quantidade, composição ou cronograma recalcula a demanda;
- o prazo de compra é configurável;
- o relatório diferencia necessidade, estoque, pedido e saldo faltante;
- itens sem preço ou sem composição aparecem como pendência, nunca são ignorados.
