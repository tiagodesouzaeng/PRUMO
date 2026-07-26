# SIGIU / Painel PPCI — Sprint 3.0 RC1

## Tema
Compactação visual dos cards e do painel.

## Base
Sprint 2.8.1 — remoção do Status duplicado inferior validada.

## Objetivo
Reduzir a altura dos cards PPCI, aumentar a densidade de leitura, aproximar o layout visual do modelo de cartões compactos e preparar o painel para refinamentos visuais posteriores.

## Arquivos alterados

- `src/components/Cards/CardPPCI.jsx`
- `src/components/Toolbar/Acoes.jsx`
- `src/App.css`

## Ajustes implementados

### Cards PPCI

- Novo layout compacto do card.
- Redução de espaçamentos internos.
- Priorização das informações principais:
  - ID
  - Prioridade
  - Unidade
  - Prédio / Edificação
  - Categoria
  - Status / Situação
  - Processo
  - Conclusão
  - Responsável
  - Vencimento
  - Prazo
  - Próximo passo
- Remoção visual de campos secundários do card, mantendo o detalhamento completo no modal.
- Texto de próximo passo limitado visualmente a duas linhas.
- Cards vencidos, críticos, em atenção e sem data continuam com sinalização lateral.

### Toolbar

- Botões encurtados:
  - `Limpar Filtros` → `Limpar`
  - `Exportar CSV` → `CSV`
  - `Atualizar Dados` → `Atualizar`
  - `Editar Planilha` → `Planilha`
- Toolbar organizada em grid responsivo.

### CSS

- Adicionado bloco final `v3.0.0 RC1` ao `App.css`.
- Compactação de:
  - header;
  - painéis;
  - dashboard executivo;
  - toolbar;
  - grid de cards;
  - cards PPCI;
  - responsividade.

## Itens preservados

- Lógica de filtros.
- Modal PPCI.
- Exportação CSV completa.
- API/Apps Script.
- Normalização dos campos.
- Tratamento de loading, erro e lista vazia.
- Análise da Carteira PPCI com Status e Categorias.
- Distribuição das Responsabilidades.
- Dashboard Executivo com Situação Geral e Conclusão Média.

## Validação recomendada

1. Rodar `npm run dev`.
2. Validar abertura do painel.
3. Confirmar compactação dos cards.
4. Abrir modal a partir de um card.
5. Testar clique nos badges Categoria e Status.
6. Testar busca, ordenação, limpar filtros, exportação CSV e atualização.
7. Verificar responsividade em tela menor.

## Status
Sprint 3.0 RC1 pronta para validação visual.
