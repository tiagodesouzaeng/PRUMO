# SIGIU – Checkpoint de Desenvolvimento

## Versão
**v2.6.0 RC1**

## Data do checkpoint
**2026-07-07**

## Arquivo-base recebido
`src_2.6.zip`

## Identificação técnica do pacote
- Quantidade de arquivos: **64**
- Tamanho do pacote original: **69,880 bytes**
- SHA-256 do pacote original: `9738c070693f3eec072682a3b2b79c299f27cf53b50423f1d10811e272903326`

## Status informado
**Validado pelo usuário.**

## Escopo consolidado até esta versão

### Sprint 1.x – Base funcional do Painel PPCI
- Leitura dos dados da planilha/API.
- Renderização dos PPCIs em cards.
- Indicadores gerais.
- Filtros e ordenação.
- Sinaleiro de vencimento.
- Exportação CSV inicial.
- Modal de detalhes PPCI.

### Sprint 1.3 – Modal PPCI
- Modal com abas.
- Exibição dos campos completos da API.
- Correção do campo **Link Processo**.
- Centralização visual do título do modal.
- CSS consolidado do modal no `App.css`.

### Sprint 2.1 – Filtros do painel
- Criação de `useFiltrosPainel.js`.
- Centralização dos estados de filtro e ordenação.
- Redução de responsabilidade do `App.jsx`.

### Sprint 2.2 – Estados de interface
- Criação de `usePainelInterface.js`.
- Centralização dos estados de modal e painéis expansíveis.

### Sprint 2.3 – Dados derivados do painel
- Criação de `usePainelPPCIDados.js`.
- Organização da composição entre dashboard, pesquisa e ordenação.
- Centralização dos nomes oficiais dos campos em `ppciCampos.js`.

### Sprint 2.4 – Exportação e Toolbar
- Exportação CSV completa com todos os campos da API/modal.
- Remoção do filtro de categoria da Toolbar.
- Manutenção do filtro por categoria na seção **Análise da Carteira PPCI**.

### Sprint 2.5 – Padronização de campos
- Uso de `PPCI_CAMPOS` e `PPCI_CAMPOS_CSV`.
- Reaproveitamento da lista oficial de campos na exportação CSV.
- Criação de utilitário para tratamento do link do processo.

### Sprint 2.6 – Loading, erro e lista vazia
- `usePPCI.js` passa a controlar:
  - `loading`;
  - `erro`;
  - `ultimaAtualizacao`;
  - recarregamento dos dados.
- Criação de `PainelFeedback.jsx`.
- Tratamento visual para:
  - carregamento;
  - erro da API;
  - lista vazia.
- Botão **Tentar novamente**.
- O painel principal só renderiza quando há dados válidos.

## Estrutura principal identificada no pacote

```text
src/
├─ App.jsx
├─ App.css
├─ components/
│  ├─ Analises/
│  ├─ Cards/
│  ├─ Dashboard/
│  ├─ Feedback/
│  ├─ Header/
│  ├─ Modal/
│  └─ Toolbar/
├─ domain/
├─ hooks/
├─ services/
└─ utils/
```

## Arquivos-chave da versão 2.6

- `src/App.jsx`
- `src/hooks/usePPCI.js`
- `src/components/Feedback/PainelFeedback.jsx`
- `src/hooks/useFiltrosPainel.js`
- `src/hooks/usePainelInterface.js`
- `src/hooks/usePainelPPCIDados.js`
- `src/domain/ppciCampos.js`
- `src/services/exportCSV.js`
- `src/components/Modal/ModalPPCI.jsx`
- `src/utils/linkProcesso.js`

## Próxima etapa recomendada

**Sprint 2.7 – Revisão de limpeza técnica antes da compactação visual**

Itens sugeridos:
1. Remover arquivos antigos ou duplicados, como `Appold.jsx` e `ModalPPCIold.jsx`, se não forem mais necessários.
2. Revisar imports não utilizados.
3. Conferir componentes ainda existentes mas não renderizados.
4. Consolidar comentários de release.
5. Preparar a base para a Sprint 3 — compactação visual inspirada no MS Planner.

## Observação
Este checkpoint deve ser tratado como a base estável do Painel PPCI antes da próxima evolução técnica.
