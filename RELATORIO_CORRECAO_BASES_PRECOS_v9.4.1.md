# Relatório de correção das bases de preços — v9.4.1

## Motivo da falha

O importador anterior considerava que a primeira linha da planilha continha os
cabeçalhos e que todos os arquivos do ZIP tinham o mesmo formato tabular. A
publicação oficial SINAPI 06/2026 possui estruturas diferentes:

- cabeçalhos de preços nas linhas 9 e 10;
- pares de colunas por unidade da federação;
- códigos de composições armazenados em fórmulas `HYPERLINK`;
- planilhas específicas para insumos, composições sintéticas e analíticas;
- arquivos auxiliares de famílias, manutenções e mão de obra.

Como consequência, nenhum código e preço válido era reconhecido no XLSX ou no
ZIP oficial.

## Solução implementada

- detecção dinâmica das linhas de cabeçalho;
- extração do código contido na fórmula de hiperlink;
- seleção de UF e regime de preço;
- leitura coordenada dos quatro arquivos do pacote da CAIXA;
- preservação das relações entre composição e seus componentes;
- armazenamento dividido entre catálogo, pacotes auxiliares e vínculos
  analíticos particionados;
- importador genérico para bases tabulares com código, descrição, unidade,
  preço e tipo;
- persistência independente do orçamento;
- seleção da base em cada item da EAP;
- componentes de composições próprias vinculados à base e à referência;
- atualização de serviços e componentes próprios quando a base for atualizada.

## Resultado com o pacote fornecido

| Conteúdo | Quantidade |
|---|---:|
| Arquivos processados | 4 |
| Referências com preço | 15.330 |
| Insumos | 4.876 |
| Composições | 10.454 |
| Vínculos analíticos | 55.657 |
| Famílias e coeficientes | 4.876 |
| Registros de manutenção | 31.475 |
| Registros de mão de obra | 8.404 |
| Registros totais preservados | 115.742 |
| Referências sem preço para RS/regime selecionado | 2.644 |

## Arquitetura para outras bases

SINAPI passa a ser um adaptador especializado dentro de um catálogo genérico.
PLEO, SBC, ORSE e futuras bases podem usar o importador tabular comum quando
possuírem colunas reconhecíveis. Formatos proprietários diferentes podem ser
adicionados como novos adaptadores sem alterar o domínio do orçamento.

O orçamento não possui mais uma base global. Cada serviço guarda sua base,
tipo e código de referência. Uma composição própria guarda os mesmos vínculos
em cada componente, permitindo recalcular seu custo quando uma nova versão da
base for aplicada.

## Validações executadas

- importação do XLSX oficial de referência;
- importação do ZIP completo fornecido;
- consulta da composição 104658 por código e preço;
- recuperação sob demanda dos componentes analíticos;
- persistência do pacote completo no IndexedDB;
- importação simulada de uma base ORSE tabular;
- compilação de produção;
- validação visual e funcional na página local.
