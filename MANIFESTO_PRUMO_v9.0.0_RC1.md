# PRUMO v9.0.0 RC1 — Módulo de Orçamentos Integrado

## Origem

- Base histórica: SIGIU v8.2.0 RC1.
- Estrutura recuperada da pasta `src` original.
- Identidade visível atualizada para PRUMO.

## Entrega

O pacote contém o código-fonte completo da aplicação e o novo módulo de Orçamentos integrado à navegação principal, ao menu móvel, à visão geral e à administração.

O módulo inclui:

- visão geral do orçamento;
- planilha orçamentária por EAP;
- bases e composições SINAPI;
- cronograma físico-financeiro;
- histograma de mão de obra;
- medições;
- revisões e rastreabilidade;
- seleção de múltiplos orçamentos;
- indicadores de custo direto, BDI, valor total e pendências.

## Execução

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Para gerar a versão de produção:

```bash
npm run build
```

## Validação

- Build de produção concluído com Vite 7.3.6.
- 138 módulos processados.
- Código-fonte e versão compilada incluídos no pacote.

## Escopo atual

Os dados demonstrativos do módulo são locais. Persistência em banco de dados, autenticação definitiva e importação automática da publicação SINAPI deverão ser conectadas aos serviços corporativos na próxima etapa.
