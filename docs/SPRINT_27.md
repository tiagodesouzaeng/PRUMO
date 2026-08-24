# Sprint 27 — Orçamento contratado e aditivos governados

## Objetivo

Preservar o orçamento aprovado como referência histórica e criar uma camada
contratual própria para execução, medições e alterações solicitadas pela obra.

## Entregas

- homologação do resultado da licitação com fornecedor, processo, contrato,
  desconto e justificativa;
- aplicação linear do desconto vencedor em todos os preços unitários, com
  truncamento financeiro e preservação dos valores publicados;
- base contratada imutável e vinculada ao orçamento, processo e contrato;
- obrigação de orçamento e contrato no cadastro de novas obras;
- saldo das medições calculado pela base contratada vigente;
- solicitação de aditivo elaborada na obra, sem alteração direta do orçamento;
- fluxo rascunho → submetida → em análise → aprovada/rejeitada → convertida;
- parecer da engenharia de custos obrigatório para aprovar ou rejeitar;
- permissões específicas, RLS, idempotência, versão e auditoria;
- painel do resultado da licitação em Orçamentos e gestão dos pedidos em Obras.

## Regra permanente

Obras e medições nunca reescrevem o orçamento publicado. Uma alteração somente
produz efeito contratual depois da análise de custos e dos atos de aprovação
aplicáveis à organização.
