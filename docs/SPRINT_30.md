# Sprint 30 — PPCI local e segurança predial

## Objetivo

Eliminar a integração externa do PPCI e consolidar o domínio no módulo de
Regularidade, usando o patrimônio corporativo como referência obrigatória.

## Entregas

- processos PPCI no PostgreSQL, com fase, status, protocolo, validade,
  ocupação, risco, área protegida, responsável e próximo passo;
- vínculo obrigatório a Site, Prédio ou Sala ativo;
- sistemas preventivos em locais descendentes do PPCI, com vínculo opcional a
  um ativo pertencente à Sala informada;
- inspeções imutáveis, vinculadas ao processo e opcionalmente ao sistema;
- RLS por empresa/equipe, concorrência otimista e eventos de auditoria;
- tela única de Regularidade para licenças, PPCI, sistemas, inspeções, riscos,
  auditorias e transparência;
- Visão geral abastecida pela API corporativa, sem Google Apps Script;
- massa fictícia das três organizações atualizada com PPCI, alarme e vistoria.

## Migrações

- `037_ppci_local_regularidade_v30.sql` — modelo, RLS, capacidades e vínculos;
- `038_endurecimento_ppci_local_v30.sql` — descendência patrimonial,
  consistência das inspeções e limpeza técnica restrita ao migrador.

## Segurança e dados

O nível Cliente permanece como agregador e não recebe PPCI diretamente. Um
sistema somente pode apontar para o próprio local do processo ou para um de
seus descendentes. Quando houver ativo, ele deve pertencer à Sala indicada.
Inspeções não podem ser alteradas ou removidas pela API.
