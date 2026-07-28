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

## Próximas etapas

### Etapa 9.5 — Submódulo de Licitações e Concorrência

Criar um ambiente para preparar e gerar o pacote de planilhas utilizado em
licitações, tomadas de preço e concorrências.

#### Arquivo consolidado

O formato padrão será um único arquivo XLSX, com as seguintes abas:

1. `00_Instruções`: identificação da concorrência, versão, data-base,
   orientações de preenchimento e legenda das células;
2. `01_Orçamento_Completo`: planilha integral do orçamento de referência, com
   EAP, quantidades, preços, descontos, BDI e fórmulas dos custos;
3. `02_Proposta_de_Preços`: modelo para o concorrente preencher somente os
   valores unitários permitidos;
4. `03_BDI_e_Encargos`: componentes do BDI e encargos com memória de cálculo;
5. `04_Cronograma`: cronograma físico-financeiro com períodos e fórmulas;
6. `05_Histograma`: histograma de mão de obra e recursos.

#### Proteção e edição

- bloquear células estruturais, fórmulas, identificadores, quantidades e totais;
- deixar desbloqueadas somente as células destinadas ao preenchimento;
- destacar visualmente as células editáveis e incluir validações de dados;
- proteger cada aba e a estrutura do arquivo;
- impedir inserção, exclusão ou renomeação acidental das abas;
- preservar as fórmulas ao abrir o arquivo no Excel e em aplicativos
  compatíveis;
- não utilizar macros nem vínculos externos;
- informar que a proteção de planilha evita alterações acidentais, mas não
  substitui segurança criptográfica.

#### Regras das fórmulas

- usar `TRUNC(...;2)` ou equivalente para reproduzir a regra financeira da
  v9.4;
- calcular os totais a partir dos preços unitários preenchidos;
- aplicar desconto, encargos e BDI na mesma ordem do orçamento de origem;
- incluir conferências entre subtotal, desconto, BDI e total;
- sinalizar células obrigatórias vazias e valores inválidos;
- manter fórmulas bloqueadas e campos de entrada desbloqueados.

#### Rastreabilidade

- identificar orçamento, revisão, base SINAPI e regra de cálculo;
- registrar data e responsável pela geração;
- gerar hash do arquivo para controle da versão distribuída;
- incluir cabeçalho e rodapé com identificação da concorrência;
- manter o arquivo gerado vinculado à revisão do orçamento.

#### Critérios de aceite

- gerar todas as cinco planilhas operacionais em um único XLSX;
- abrir o arquivo sem alertas de corrupção ou reparação;
- permitir edição somente nos campos explicitamente liberados;
- manter todas as fórmulas protegidas;
- recalcular corretamente custos, BDI, cronograma e histograma;
- reproduzir o truncamento monetário da aplicação;
- preservar impressão, filtros, congelamento de painéis e larguras de coluna;
- validar o arquivo no Microsoft Excel e em pelo menos um leitor compatível.

### Etapa 9.6 — Integração automatizada final

Substituir importações manuais por integrações estruturadas quando as fontes
oficiais e a infraestrutura compartilhada estiverem disponíveis.

#### Entrega intermediária v9.6.0

- central administrativa de integrações por fonte;
- configuração de URL direta para o arquivo oficial;
- execução assistida de download e importação;
- validação de transporte seguro e formatos aceitos;
- reaproveitamento integral do importador, versionamento, hash e auditoria;
- conectores preparados para SINAPI, PLEO, SBC e ORSE;
- agendamento automático condicionado à implantação de backend e à existência de
  endpoint oficial estável.
