# Sprint 13 — Suprimentos e Contratações

## Resultado

A Sprint 13 conecta demandas incorporadas e orçamentos ao ciclo de aquisição.
O novo módulo mantém fornecedores, planejamento da contratação, estudo técnico,
riscos, termo de referência, pesquisa de preços, julgamento, pedidos e
recebimentos no PostgreSQL, com RLS, permissões segregadas e auditoria.

Situação local: concluída na versão `13.0.0`, aguardando homologação do usuário.

## Escopo entregue

- fornecedores compartilhados por empresa e equipe, com qualificação e status;
- processo originado obrigatoriamente por demanda incorporada ou orçamento;
- perfis de contratação para setor público, federações e organizações privadas;
- estudo técnico preliminar, matriz de riscos e termo de referência;
- critérios de julgamento por menor preço, maior desconto, técnica e preço ou melhor técnica;
- pesquisa de preços com propostas, validade, prazo e memória estatística;
- seleção e marcação auditável da proposta vencedora;
- pedido vinculado ao processo, fornecedor e proposta;
- recebimentos parciais ou integrais, aceite, ressalva ou rejeição;
- conclusão automática quando todos os pedidos forem integralmente recebidos;
- interface própria com indicadores, processos, fornecedores, pedidos e detalhe.

## Fluxo governado

`Rascunho > Planejamento > Pesquisa de preços > Seleção > Aprovada > Pedido emitido > Concluída`

Devoluções e cancelamentos exigem justificativa. Alterações usam `If-Match`,
criações usam chave de idempotência e decisões e recebimentos são imutáveis.

## Permissões

- `suprimentos.consultar`;
- `suprimentos.editar`;
- `suprimentos.cotar`;
- `suprimentos.julgar`;
- `suprimentos.aprovar`;
- `suprimentos.receber`.

## Persistência e integração

A migração `020_suprimentos_contratacoes.sql` cria fornecedores, processos,
propostas, decisões, pedidos e recebimentos. As seis tabelas possuem RLS forçado
por empresa e equipe. Suprimentos depende de Planejamento e aceita Orçamentos
como integração opcional. Contratos receberá os processos aprovados na Sprint 14.

## Validação de encerramento

- 20 migrações aplicadas com checksum preservado;
- 127 testes aprovados, sem falhas ou testes ignorados;
- teste PostgreSQL real confirmou isolamento entre equipes e o ciclo completo;
- build Vite aprovado;
- API `13.0.0`, PostgreSQL e frontend local ativos;
- backup `prumo-20260810T161111Z.backup` verificado e restaurado com sucesso;
- nenhuma publicação, commit, push, PR ou deploy executado.

## Roteiro de homologação

1. abrir `Suprimentos` no menu lateral;
2. cadastrar ao menos um fornecedor qualificado;
3. criar um processo a partir de demanda incorporada ou orçamento;
4. preencher estudo técnico e termo de referência;
5. iniciar planejamento e abrir a pesquisa de preços;
6. registrar uma ou mais propostas e iniciar a seleção;
7. aprovar a menor proposta e emitir o pedido;
8. registrar o recebimento e conferir a conclusão e a trilha de decisões.

## Continuidade

A próxima etapa é a Sprint 14 — Contratos. Ela receberá o resultado aprovado de
Suprimentos e manterá instrumentos, atas, vigência, saldos, fiscais, gestores,
aditivos, garantias, ocorrências, sanções e encerramento.
