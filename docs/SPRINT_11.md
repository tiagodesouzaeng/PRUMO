# Sprint 11 — Cadastro patrimonial canônico

## Resultado

A Sprint 11 estabelece no PRUMO uma fonte corporativa única para a estrutura
física `Cliente > Site > Prédio > Sala`. O domínio é independente da EAP de
orçamento e pode ser referenciado por Obras, Manutenção, Regularidade,
Utilidades, Documentos e Relatórios sem duplicar cadastros.

Situação local: concluída na versão `11.0.0`, aguardando homologação do usuário.

## Entregas funcionais

- novo módulo `Patrimônio e Espaços` no catálogo e na navegação;
- árvore com os quatro níveis obrigatórios e validação da relação pai/filho;
- identificação, endereço, área, responsável, ocupação e situação por unidade;
- ativos e equipamentos obrigatoriamente vinculados a uma sala ativa;
- movimentação entre salas com origem, destino, motivo, responsável e data;
- bloqueio da troca de sala pela edição comum do ativo;
- bloqueio da desativação de unidades que ainda possuem filhos ou ativos ativos;
- edição com controle de versão e proteção contra sobrescrita concorrente;
- interface responsiva para cadastro, edição, seleção da árvore, ativos e histórico;
- empreendimentos podem armazenar `patrimonioUnidadeId` validado na mesma equipe;
- documentos podem ser vinculados às entidades do módulo Patrimônio.

## Banco e segurança

Migrações da sprint:

- `012_cadastro_patrimonial_canonico.sql`: módulo, permissões, capacidades,
  árvore, ativos, movimentações, referência em empreendimentos e RLS;
- `013_endurecimento_movimentacao_patrimonial.sql`: histórico imutável e troca
  de sala exclusivamente pela operação de movimentação;
- `014_limpeza_tecnica_patrimonio.sql`: limpeza restrita ao migrador e somente
  para organizações técnicas nomeadas `Teste %`.
- `015_compatibilidade_ativacao_modular.sql`: preserva empresas que utilizam a
  política legada de todos os módulos ativos sem lista explícita.
- `016_dependencias_modulares_padrao.sql`: aplica dependências também às novas
  organizações que ainda utilizam contratos implícitos do catálogo.

As tabelas `app.patrimonial_units`, `app.patrimonial_assets` e
`app.patrimonial_movements` usam RLS forçado por empresa e equipe. A API possui
conta limitada e as ações relevantes produzem eventos de domínio e auditoria.

Permissões:

- `patrimonio.consultar`;
- `patrimonio.editar`;
- `patrimonio.movimentar`.

O módulo Obras depende do Patrimônio no catálogo modular para impedir a criação
de uma hierarquia física paralela.

## Contrato da API

- `GET|POST /v1/patrimonio/unidades`;
- `GET|PUT /v1/patrimonio/unidades/:id`;
- `GET|POST /v1/patrimonio/ativos`;
- `PUT /v1/patrimonio/ativos/:id`;
- `GET|POST /v1/patrimonio/ativos/:id/movimentacoes`;
- `POST /v1/empreendimentos` aceita a referência `patrimonioUnidadeId`.

Criações e movimentações exigem chave de idempotência. Alterações exigem a
versão conhecida no cabeçalho `If-Match`.

## Validação de encerramento

- 16 migrações aplicadas e checksums preservados;
- 109 testes aprovados, sem falhas ou testes ignorados;
- testes reais confirmaram a hierarquia no PostgreSQL e o isolamento por equipe;
- build Vite aprovado;
- backup `prumo-20260809T193547Z.backup` verificado;
- SHA-256 `0c26fa7996b2b1e89c7a17b525d447c82fcb1270f37af32a88f09de71618b04e`;
- restauração aprovada em `prumo_restauracao_teste`, com 16 migrações e as três
  tabelas patrimoniais confirmadas.

## Roteiro de homologação

1. abrir o módulo Patrimônio;
2. cadastrar Cliente, Site, Prédio e ao menos duas Salas;
3. tentar criar um nível fora da sequência e confirmar o bloqueio;
4. cadastrar um ativo em uma sala;
5. movimentá-lo para outra sala e consultar o histórico;
6. tentar desativar uma sala com ativo em operação e confirmar o bloqueio;
7. verificar os eventos do módulo `patrimonio` em Administração > Auditoria.

## Continuidade

A próxima etapa é a Sprint 12 — Demandas e Carteira de Investimentos. Demandas
deverão referenciar os identificadores patrimoniais criados nesta sprint.
