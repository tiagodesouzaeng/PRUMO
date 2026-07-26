# PRUMO — Módulo de Orçamentos Integrado

Pacote completo baseado no `src` histórico do SIGIU v8.2.0 RC1, atualizado
visualmente para PRUMO e acrescido do módulo de Orçamentos.

## Conteúdo integrado

- base histórica: PPCI, alertas, consumo hídrico, obras, manutenção,
  relatórios e administração;
- novo módulo de Orçamentos no menu lateral e na navegação móvel;
- planilha orçamentária e EAP;
- bases SINAPI versionadas e composições;
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

O módulo já oferece persistência local e um motor orçamentário editável.
A autenticação, o banco relacional compartilhado e a importação automática
das publicações SINAPI devem ser conectados nas próximas etapas.
