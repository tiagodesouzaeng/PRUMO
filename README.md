# PRUMO — Módulo de Orçamentos Integrado

Pacote completo baseado no `src` histórico do SIGIU v8.2.0 RC1, atualizado
visualmente para PRUMO e acrescido do módulo de Orçamentos.

## Conteúdo integrado

- base histórica: PPCI, alertas, consumo hídrico, obras, manutenção,
  relatórios e administração;
- novo módulo de Orçamentos no menu lateral e na navegação móvel;
- planilha orçamentária e EAP;
- bases de preços versionadas e independentes dos orçamentos;
- BDI, encargos e indicadores;
- cronograma físico-financeiro;
- histograma de mão de obra;
- medições, saldos e revisões;
- múltiplos orçamentos e revisões imutáveis.

## Persistência local — v9.1

- criação de novos orçamentos;
- inclusão e exclusão de serviços;
- cálculos automáticos de custo direto, BDI, preço total e valor por área;
- totais de grupos calculados pela EAP;
- criação de revisões;
- exportação do orçamento em JSON;
- restauração dos dados e do orçamento ativo após recarregar a aplicação.

## Motor orçamentário — v9.2

- edição, duplicação, exclusão e ordenação de itens;
- criação e manutenção de grupos da EAP;
- exclusão controlada de grupos e seus serviços;
- BDI detalhado por componentes e memória de cálculo;
- cadastro de composições próprias;
- importação de planilhas CSV, XLS e XLSX;
- validação de códigos, descrições, quantidades, preços e unidades;
- comparação de snapshots entre revisões;
- remoção completa das referências fixas à marca ULBRA.

## Integração SINAPI — v9.3

- número do serviço gerado automaticamente após selecionar o grupo da EAP;
- serviço inserido automaticamente dentro do grupo selecionado;
- criação rápida de grupo dentro do cadastro do serviço;
- importação das publicações oficiais em ZIP, XLSX ou XLS;
- bases separadas por UF, referência mensal e regime;
- armazenamento estruturado em IndexedDB;
- hash SHA-256 do arquivo importado;
- catálogo pesquisável de composições no cadastro do serviço;
- alerta e bloqueio de atualização para referências com preço zerado;
- atualização dos preços dos serviços vinculados à base ativa.

## Correção e generalização das bases de preços — v9.4.1

- leitura do pacote ZIP completo publicado pela CAIXA, incluindo referência,
  famílias e coeficientes, manutenções e mão de obra;
- reconhecimento dos cabeçalhos oficiais em linhas variáveis e dos códigos de
  composições armazenados em fórmulas de hiperlink;
- catálogo unificado de insumos e composições, com vínculos analíticos
  preservados para consulta sob demanda;
- importador genérico para PLEO, SBC, ORSE e futuras bases tabulares;
- bases de preços persistidas fora dos orçamentos;
- escolha explícita da base e da referência em cada serviço;
- composições próprias formadas por insumos ou composições de qualquer base
  importada;
- atualização dos itens e componentes próprios quando uma nova versão da base
  for aplicada.

## Motor financeiro — v9.4

- preços unitários com precisão superior a duas casas decimais;
- preservação da precisão original para cadastro, importação e memória;
- truncamento obrigatório, sem arredondamento, após a segunda casa decimal;
- desconto global informado como percentual ou valor monetário;
- cálculo automático do percentual quando o desconto for informado em valor;
- distribuição e auditoria do desconto em cada serviço do orçamento;
- controle do resíduo de centavos para fechamento exato do desconto global;
- apresentação dos valores bruto, descontado e líquido por serviço e grupo;
- aplicação do BDI sobre o custo direto líquido;
- preservação da regra financeira e dos totais nas novas revisões.

## Licitações e concorrência — etapa planejada v9.5

- submódulo para geração do pacote de planilhas da concorrência;
- arquivo XLSX único com abas de instruções, orçamento completo, proposta de
  preços, BDI e encargos, cronograma e histograma;
- fórmulas protegidas e células de preenchimento explicitamente desbloqueadas;
- cálculos compatíveis com o truncamento monetário da v9.4;
- identificação da revisão, bases utilizadas pelos itens e versão do arquivo distribuído;
- validações, filtros, impressão e congelamento de painéis preparados para uso.

## Execução

Requisitos já utilizados na validação:

- Node.js 20 ou superior;
- pnpm 11 ou superior.

```bash
pnpm install
pnpm dev
```

Validação de produção:

```bash
pnpm build
```

O npm também pode ser utilizado, mas o projeto fixa o pnpm 11.9.0 para
manter instalações reproduzíveis entre os ambientes.

## Observação

O módulo oferece persistência local, motor orçamentário editável e importação
manual de bases versionadas. A autenticação, o banco relacional compartilhado
e futuras integrações automatizadas com as fontes oficiais devem ser conectados
nas próximas etapas.
