# SIGIU — Sprint 2.6 — Estados de carregamento e erro

## Objetivo
Adicionar tratamento visual para carregamento, erro de API e lista vazia no Painel PPCI.

## Arquivos alterados

- `src/App.jsx`
- `src/hooks/usePPCI.js`
- `src/App.css` — apenas acrescentar o bloco CSS adicional

## Arquivo novo

- `src/components/Feedback/PainelFeedback.jsx`

## Validação

1. Rodar `npm run dev`.
2. Confirmar carregamento inicial dos dados.
3. Clicar em Atualizar.
4. Simular erro na API, se necessário, alterando temporariamente a URL de origem.
5. Confirmar que o botão "Tentar novamente" executa nova busca.
6. Confirmar que o painel principal não aparece quando há erro ou lista vazia.

## Observação
Esta sprint não altera filtros, cards, modal, CSV ou normalização dos campos PPCI.
