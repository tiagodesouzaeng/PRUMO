# SIGIU / Painel PPCI — Sprint 5.1 RC1

## Tema
Saúde da Base PPCI — relatório operacional de pendências.

## Objetivo
Transformar a seção recolhível de Saúde da Base de Dados em um ponto de ação para revisão cadastral, permitindo exportar pendências e abrir rapidamente os PPCIs afetados no modal.

## Alterações incluídas

- A seção Saúde da Base permanece recolhível e inicia recolhida.
- Inclusão de botão geral **Exportar pendências CSV**.
- Inclusão de botão por tipo de pendência: **Exportar esta pendência**.
- Exemplos de PPCIs afetados passam a ser clicáveis.
- Ao clicar em um PPCI afetado, o modal de detalhes abre com o registro selecionado.
- O hook `useQualidadeDados` passa a devolver registros detalhados das pendências, preservando os indicadores já existentes.
- Criado serviço `exportQualidadeCSV.js` para gerar relatório em CSV com dados da pendência e campos principais do PPCI.

## Arquivos alterados

```txt
src/App.jsx
src/App.css
src/hooks/useQualidadeDados.js
src/components/QualidadeDados/QualidadeDados.jsx
```

## Arquivo criado

```txt
src/services/exportQualidadeCSV.js
```

## Validação sugerida

1. Abrir o painel.
2. Expandir **Saúde da Base de Dados**.
3. Conferir os indicadores já existentes.
4. Clicar em **Exportar pendências CSV**.
5. Clicar em **Exportar esta pendência** em um item específico.
6. Clicar em um PPCI listado nos exemplos.
7. Confirmar abertura do modal correto.
8. Confirmar que filtros, cards/lista, CSV principal e preferências continuam funcionando.

## Observação
Esta sprint não altera API, planilha, filtros principais, ordenação, CSV principal ou regra de cálculo de vencimentos. A mudança é analítica/operacional sobre a base já carregada.
