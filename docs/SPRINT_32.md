# Sprint 32 — Operação de campo e manutenção preventiva

## Situação

Planejada para a versão `32.0.0`. Este documento registra o escopo aprovado;
nenhuma das alterações abaixo está considerada implementada antes do
fechamento técnico e funcional da Sprint.

## Objetivo

Eliminar dificuldades observadas na homologação do PPCI e tornar a operação
de campo adequada a equipes com diferentes níveis de familiaridade digital.
Ao mesmo tempo, consolidar a coerência dos endereços patrimoniais e ligar cada
ativo aos seus planos e históricos de manutenção.

## Frente 1 — PPCI e inspeções

- ampliar e tornar responsivo o diálogo de cadastro e edição do PPCI;
- eliminar a barra de rolagem horizontal em resoluções usuais;
- organizar campos em colunas que se reorganizam em telas menores, mantendo
  ações e títulos sempre visíveis;
- corrigir a remoção de sistemas preventivos, com confirmação, motivo,
  mensagem de sucesso ou diagnóstico do bloqueio e atualização imediata;
- permitir excluir inspeções pela interface;
- tratar a exclusão de inspeção como anulação auditada, sem apagar a evidência
  técnica: motivo, autor, data e conteúdo original devem ser preservados;
- recalcular o estado do sistema e do PPCI depois de uma anulação válida.

## Frente 2 — Utilidades e coleta simplificada

Cada medidor deverá informar seu método de lançamento:

1. **Consumo direto:** o funcionário registra a quantidade consumida no
   período.
2. **Leitura acumulada do relógio:** o funcionário registra o número exibido
   no equipamento e o PRUMO calcula o consumo pela diferença entre a leitura
   atual e a última leitura válida anterior.

Regras do cálculo acumulado:

- a primeira leitura estabelece a linha de base e não inventa consumo;
- cada consumo calculado guarda a leitura anterior utilizada e a memória do
  cálculo;
- datas duplicadas, valores menores que a leitura anterior, troca de relógio,
  reinício de contador e virada de escala exigem confirmação e justificativa;
- anulações e correções preservam os valores originais na auditoria;
- multiplicador, unidade, natureza (consumo, geração, crédito ou débito) e fuso
  horário do cliente fazem parte do cálculo;
- nenhuma leitura de outra empresa ou equipe pode ser usada como referência.

Será criada uma página **Leitura rápida** com:

- um medidor por vez, identificação grande e local claramente destacado;
- botões grandes, alto contraste, textos curtos e fluxo guiado;
- somente data/hora, valor, confirmação e, quando necessário, observação;
- leitura por teclado numérico, validação imediata e resumo antes de salvar;
- indicação visual da última leitura e do consumo calculado;
- opção de anexar foto do mostrador como evidência;
- retorno inequívoco de sucesso, erro ou necessidade de correção;
- acesso restrito aos medidores atribuídos ao funcionário ou à sua equipe.

Metas, tarifas, faturas, alertas e importação em lote continuam no escopo de
Utilidades da Sprint 32, sem prejudicar a prioridade da coleta de campo.

## Frente 3 — Endereço patrimonial

- o Site permanece como fonte do endereço físico operacional;
- o formulário do Site terá a ação **Copiar endereço do cliente**;
- a cópia deverá preencher logradouro, número, complemento, bairro, cidade,
  UF e CEP, permitindo revisão antes de salvar;
- Prédios e Salas herdarão o endereço do Site e não manterão cópias editáveis
  divergentes;
- consultas e relatórios deverão resolver o endereço pelo Site ancestral;
- a migração deverá normalizar dados existentes sem perder informações e
  apontar divergências para revisão administrativa.

## Frente 4 — Ativos e manutenção preventiva

- permitir um ou mais planos de manutenção periódica por ativo/equipamento;
- cada plano deverá possuir serviço, periodicidade em dias ou meses, data-base,
  próxima execução, responsável ou equipe, prioridade e situação;
- gerar previsões e ordens no módulo Manutenção sem duplicidade;
- recalcular a próxima execução ao concluir uma manutenção, respeitando a
  política configurada no plano;
- alertar vencimentos e atrasos na Manutenção e na Visão Geral;
- adicionar no detalhe do ativo a guia **Manutenções**, com planos, próximas
  intervenções, ordens abertas e histórico concluído;
- adicionar em cada manutenção um vínculo para retornar ao ativo e ao seu local
  patrimonial;
- preservar peças, custos, documentos, responsáveis e evidências do histórico.

## Persistência e segurança previstas

- novas migrações PostgreSQL com checksum, RLS forçada e isolamento por empresa
  e equipe;
- controle de concorrência para exclusões, anulações, leituras e planos;
- idempotência na geração automática de manutenções;
- permissões distintas para administrar medidores, registrar leituras, anular
  inspeções e administrar planos preventivos;
- trilha de auditoria para criação, alteração, exclusão lógica, cálculo e
  geração de ordens.

## Critérios de aceite

- diálogo do PPCI utilizável sem rolagem horizontal nas resoluções de notebook
  e desktop homologadas;
- exclusão de sistema preventivo funcionando e explicando qualquer bloqueio;
- inspeção anulada deixa de valer operacionalmente, mas continua auditável;
- testes comprovam os dois métodos de leitura e a memória do cálculo;
- a página Leitura rápida pode ser concluída sem navegar pelos cadastros
  administrativos;
- Prédio e Sala sempre exibem o endereço corrente do Site ancestral;
- Site copia o endereço do cliente sem salvar automaticamente;
- plano periódico gera a manutenção uma única vez e aparece no histórico do
  ativo e no módulo Manutenção;
- testes unitários, API, integração PostgreSQL, RLS, acessibilidade essencial e
  build de produção aprovados.
