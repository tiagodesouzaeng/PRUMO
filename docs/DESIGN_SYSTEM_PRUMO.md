# Design System PRUMO

## Referência

A versão 13.1 consolida o módulo Orçamentos como referência de densidade,
hierarquia tipográfica e apresentação para toda a plataforma. A camada comum
fica em `src/styles/prumoUnified.css` e é carregada depois dos estilos históricos
para manter compatibilidade com as telas já entregues.

## Fundamentos visuais

| Uso | Padrão |
| --- | --- |
| Fundo da aplicação | `#f4f7f8` |
| Superfície | `#ffffff` |
| Azul de títulos | `#123247` |
| Verde de ação | `#087f73` |
| Texto principal | `#263a45` |
| Texto auxiliar | `#72828a` |
| Bordas | `#dfe6e8` |
| Fonte de interface | Inter, Segoe UI, Arial, sem serifa |
| Fonte de títulos e indicadores | Georgia, Times New Roman, serifa |

## Escala tipográfica

- 27 px: título principal da página;
- 20 px: valores de indicadores e títulos de modal;
- 17 px: títulos de seção e cartão;
- 12 px: descrições e abas;
- 11 px: texto operacional, botões, rótulos e campos;
- 10 px: células de tabela;
- 8–9 px: cabeçalhos de tabela, marcadores e metadados.

## Componentes canônicos

- cabeçalho: `sigiu-page-heading sigiu-page-heading--modulo`;
- marcador superior: `sigiu-page-eyebrow`;
- cartão: `sigiu-card`;
- botão: `sigiu-btn` e suas variantes;
- campo: `sigiu-input` ou campos nativos dentro de `sigiu-content`;
- abas: `sigiu-tabs`, `sigiu-admin-tabs` ou abas específicas compatibilizadas;
- indicadores: `sigiu-module-kpis` e `sigiu-module-kpi`;
- estados: `sigiu-chip`, `sigiu-status` ou `sigiu-status-chip`;
- modais e painéis laterais: superfícies brancas, raio de 12 px e sombra comum.

## Regras de evolução

1. Não criar novas cores ou escalas tipográficas dentro de uma página.
2. Reutilizar primeiro tokens e componentes existentes.
3. Manter ações primárias em verde, títulos em azul e textos auxiliares em cinza.
4. Usar fonte serifada apenas para títulos, números de destaque e indicadores.
5. Preservar rolagem horizontal em abas e tabelas para não ocultar funções.
6. Validar desktop, janela estreita e navegação com menu recolhido antes de concluir uma tela.
