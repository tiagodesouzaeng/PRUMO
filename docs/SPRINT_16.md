# Sprint 16 — Obras e medições corporativas

## Resultado

A Sprint 16 transforma as telas demonstrativas de Obras em uma operação
corporativa persistida no PostgreSQL. A obra reutiliza a estrutura patrimonial,
os contratos, os orçamentos, os documentos e a execução financeira do PRUMO.

Situação local: concluída na versão `16.0.0`, incorporada ao fechamento `17.0.0`
e aguardando homologação do usuário.

## Escopo entregue

- obra vinculada à hierarquia `Cliente > Site > Prédio > Sala`;
- referências opcionais para contrato e orçamento, sem duplicação de cadastros;
- responsável, período, valor previsto, progresso físico e saldo a medir;
- cronograma físico-financeiro com etapas, peso, valor e progresso;
- diário imutável com data, clima, efetivo, atividades, ocorrências e evidências;
- boletins de medição por obra e período;
- itens analíticos preparados para quantidades previstas, do período e acumuladas;
- retenções, glosas, multas e valor líquido atestado;
- envio, análise, aprovação, devolução, glosa, aceite e cancelamento;
- resumo executivo com prazo, progresso físico, progresso financeiro e pendências.

## Governança

As permissões distinguem consulta, edição da carteira, fiscalização, registro e
aprovação de medições. Obra e medição possuem controle otimista de versão,
idempotência e auditoria. Diários e decisões são históricos imutáveis.

Fluxo da obra:

`Planejamento > Em andamento > Suspensa/Concluída`

Fluxo da medição:

`Rascunho > Em análise > Aprovada > Aceita`

Devoluções retornam o boletim ao rascunho. Glosas e cancelamentos exigem
justificativa. A soma das deduções não pode superar o valor bruto e uma medição
não pode ultrapassar o saldo disponível da obra.

## Persistência

A migração `023_obras_medicoes_corporativas.sql` amplia `app.empreendimentos` e
`app.medicoes`, preservando compatibilidade, e cria cronograma, diário, itens e
decisões. Todas as novas tabelas usam RLS forçado por empresa e equipe.

## Roteiro de homologação

1. abrir `Obras` e cadastrar uma obra em um local patrimonial;
2. iniciar a obra e adicionar uma etapa ao cronograma;
3. registrar uma entrada no diário;
4. cadastrar um boletim com retenção ou glosa;
5. enviar, aprovar e registrar o aceite;
6. conferir valor medido, saldo e progresso no painel e no detalhe.
