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

Os dados do módulo de Orçamentos são demonstrativos. A persistência,
autenticação, banco relacional e importação efetiva dos arquivos SINAPI
devem ser conectados na próxima etapa de desenvolvimento.
