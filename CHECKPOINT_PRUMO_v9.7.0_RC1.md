# Checkpoint PRUMO v9.7.0 RC1

Data: 28/07/2026

## Correção da exportação de licitações

- corrigido o tratamento da EAP ausente na linha-resumo do histograma;
- o pacote continua sendo gerado com seis abas, fórmulas e proteções;
- o vínculo de download passa a ser anexado temporariamente ao documento;
- incluído teste de regressão com serviço sem composição analítica.

## Planejamento de suprimentos

- nova etapa `Suprimentos` dentro do orçamento;
- explosão recursiva de composições próprias e das bases importadas;
- consolidação por base, código e unidade;
- cálculo de quantidade acumulada, preço básico e valor estimado;
- rastreabilidade dos serviços que originaram cada insumo;
- cache de leitura das memórias externas durante a consolidação;
- identificação de ciclos, itens sem preço, referências incompletas e
  composições sem memória analítica;
- pesquisa por código, descrição ou base e atualização manual da consolidação.

## Próximo incremento

- distribuir a demanda consolidada conforme o cronograma físico;
- permitir antecedência configurável;
- calcular datas de necessidade e compra recomendada;
- incorporar estoque disponível e pedidos emitidos.

## Validação

- 17 testes automatizados aprovados;
- pacote XLSX gerado e reaberto com sucesso;
- compilação de produção concluída;
- navegação e pendências da nova etapa conferidas na interface local;
- nenhuma exceção registrada na geração local do pacote.
