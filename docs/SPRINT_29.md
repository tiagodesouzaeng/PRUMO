# Sprint 29 — Promoção verificável dos repositórios

## Objetivo

Permitir que Orçamentos deixe de usar o navegador como fonte principal somente
quando o conteúdo local homologado e o conteúdo do PostgreSQL forem
comprovadamente equivalentes.

## Entregas

- manifesto local determinístico com SHA-256 por orçamento e hash consolidado;
- comparação de quantidade, identificadores, registros ausentes, excedentes e
  divergentes;
- evidência de verificação persistida e imutável no PostgreSQL;
- promoção ao modo corporativo condicionada a paridade válida nas últimas 24
  horas;
- concorrência otimista na Administração para impedir decisões sobre uma versão
  desatualizada;
- retorno ao modo híbrido somente com justificativa auditável;
- cache local preservado como contingência, sem ser sobrescrito no modo
  corporativo;
- indisponibilidade da API explicitada, sem queda silenciosa para edição local;
- testes de unidade, API e PostgreSQL real cobrindo promoção, bloqueios e retorno.

## Limite desta etapa

A promoção definitiva foi habilitada inicialmente para Orçamentos. Composições
próprias, bases de preços e configurações continuam no fluxo híbrido até
receberem normalização e critérios de paridade específicos para cada domínio.

## Regra permanente

Homologar um lote não autoriza, por si só, a troca da fonte principal. A promoção
exige evidência íntegra e recente; nenhuma etapa apaga automaticamente os dados
locais ou corporativos.
