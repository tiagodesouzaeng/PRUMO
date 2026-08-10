# Checkpoint PRUMO v13.1.0

## Resultado

A apresentação da plataforma foi consolidada em um design system único, usando
o módulo Orçamentos como referência de densidade visual. A alteração não muda
regras de negócio nem o banco de dados.

## Padronização aplicada

- paleta comum em azul `#123247`, verde `#087f73`, texto `#263a45`, texto
  auxiliar `#72828a`, borda `#dfe6e8` e fundo `#f4f7f8`;
- Inter/Segoe UI/Arial para interface e Georgia para títulos e indicadores;
- cabeçalhos, cartões, KPIs, botões, campos, abas, tabelas, chips, modais e
  painéis laterais com a mesma escala;
- Planejamento e Suprimentos convertidos para o cabeçalho canônico;
- abas com rolagem horizontal e responsividade preservada;
- regras documentadas em `docs/DESIGN_SYSTEM_PRUMO.md`.

## Validação local

- 129 testes aprovados, sem falhas ou testes ignorados;
- build Vite de produção aprovado;
- frontend local respondeu HTTP 200;
- folha visual unificada respondeu HTTP 200;
- API `13.1.0` com PostgreSQL saudável;
- nenhuma migração necessária;
- nenhum commit, push, PR ou deploy executado.

## Homologação visual sugerida

Percorrer Visão Geral, Patrimônio, Planejamento, Orçamentos, Suprimentos,
Documentos e Administração em janela maximizada e estreita, incluindo abas,
formulários, tabelas, modais e o menu lateral recolhido.
