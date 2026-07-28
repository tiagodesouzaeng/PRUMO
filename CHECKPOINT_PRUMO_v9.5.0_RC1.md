# Checkpoint PRUMO v9.5.0 RC1

Data: 28/07/2026

## Submódulo de Licitações e Concorrência

- nova etapa `Licitações` imediatamente antes de `Revisões`;
- painel de emissão com identificação do orçamento e da revisão;
- geração de arquivo XLSX único;
- abas de Instruções, Orçamento Completo, Proposta de Preços,
  BDI e Encargos, Cronograma e Histograma;
- fórmulas protegidas com senha administrativa;
- células de preenchimento desbloqueadas e destacadas;
- preço total, desconto e BDI vinculados ao orçamento ativo;
- cronograma configurável em 12 meses;
- histograma derivado das composições próprias e da distribuição mensal;
- recálculo automático solicitado ao Excel na abertura.

## Validação concluída

- 9 testes automatizados aprovados;
- compilação de produção concluída;
- seis abas inspecionadas e renderizadas visualmente;
- nenhuma ocorrência de `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?` ou `#N/A`;
- proteção confirmada na Proposta de Preços;
- célula de preço unitário desbloqueada e fórmula de total bloqueada;
- download concluído pela interface local do PRUMO.

## Dependência de geração

- `exceljs` utilizado exclusivamente na emissão do pacote para preservar estilos,
  células desbloqueadas e proteção de planilha;
- a leitura das bases SINAPI e demais importações continua utilizando o fluxo
  existente, sem alteração.
