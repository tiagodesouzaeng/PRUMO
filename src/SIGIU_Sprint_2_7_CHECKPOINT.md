# SIGIU / Painel PPCI — Sprint 2.7.0 RC1

## Objetivo

Limpeza técnica da base validada na versão 2.6 antes da entrada na Sprint 3, dedicada à compactação visual inspirada no MS Planner.

## Tipo da entrega

Manutenção estrutural sem alteração funcional planejada.

## Itens executados

- Remoção de arquivos antigos de backup do `src`.
- Remoção de componentes órfãos do modal que não são importados pela versão atual.
- Remoção do componente `Categoria.jsx` da Toolbar, pois o filtro por categoria permanece apenas na seção Análise da Carteira PPCI.
- Atualização do barrel export da Toolbar (`src/components/Toolbar/index.js`).
- Remoção de arquivos `dir.txt` gerados localmente.
- Remoção de assets padrão do Vite/React não utilizados.
- Remoção de `src/utils/mapPPCI.js`, mantendo a versão oficial em `src/domain/mapPPCI.js`.

## Arquivos removidos

```text
src/Appold.jsx
src/hooks/usePPCIold.js
src/components/Modal/ModalPPCIold.jsx
src/components/Modal/ModalFooter.jsx
src/components/Modal/ModalHeader.jsx
src/components/Modal/ModalTabs.jsx
src/components/Modal/tabs/
src/components/Toolbar/Categoria.jsx
src/components/Dashboard/useDashboardData.js
src/utils/mapPPCI.js
src/dir.txt
src/components/dir.txt
src/assets/
```

## Arquivos alterados

```text
src/App.jsx
src/components/Toolbar/Toolbar.jsx
src/components/Toolbar/index.js
```

## Arquivos mantidos como base ativa

```text
src/components/Modal/ModalPPCI.jsx
src/domain/ppciCampos.js
src/utils/linkProcesso.js
src/services/exportCSV.js
src/hooks/usePPCI.js
src/hooks/useFiltrosPainel.js
src/hooks/usePainelInterface.js
src/hooks/usePainelPPCIDados.js
```

## Validação recomendada

Executar:

```bash
npm run dev
```

Validar:

- carregamento inicial do painel;
- mensagem de loading/erro/lista vazia;
- busca textual;
- filtros por análise da carteira;
- ordenação;
- botão limpar filtros;
- exportação CSV;
- abertura e fechamento do modal;
- link do processo no modal.

## Próxima etapa

Sprint 3.0 — compactação visual do painel e dos cards PPCI, com referência no MS Planner e no mockup aprovado.
