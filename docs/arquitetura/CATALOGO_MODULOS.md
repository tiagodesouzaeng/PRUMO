# Catálogo modular do PRUMO

## Posicionamento do produto

O PRUMO é uma única plataforma modular para governança de patrimônio, obras,
contratos, serviços e investimentos. `PRUMO ERP` e `PRUMO Governança` são
edições comerciais formadas por módulos da mesma plataforma, e não produtos ou
bases de código independentes.

O público prioritário é composto por órgãos e entidades públicas, federações e
organizações com patrimônio e operação distribuídos. Empresas privadas e
escritórios de engenharia e arquitetura podem utilizar os mesmos módulos com
terminologia e fluxos adequados ao seu perfil.

## Núcleo compartilhado

O núcleo não é comercializado isoladamente e acompanha qualquer contratação:

- organizações, empresas, equipes, usuários e vínculos;
- perfis, permissões, licenças e capacidades habilitadas;
- cadastro físico `Cliente > Site > Prédio > Sala`;
- autenticação, sessão e isolamento multiempresa;
- arquivos, comentários, tarefas e notificações;
- pesquisa, integrações, filas e trabalhos assíncronos;
- auditoria, retenção, backup e restauração;
- relatórios e administração da plataforma.

Ativos e equipamentos podem ser vinculados a uma sala, mas não alteram a
hierarquia física canônica.

## Módulos funcionais

| ID planejado | Módulo | Responsabilidade | Situação em v10.3.0 |
|---|---|---|---|
| `visao-geral` | Visão Geral | Indicadores e visão consolidada | Existente |
| `patrimonio` | Patrimônio Imobiliário | Sites, prédios, salas, áreas, ocupação e ativos | Planejado |
| `planejamento` | Demandas e Investimentos | Demandas, prioridades, programas e carteira | Planejado |
| `obras` | Obras e Reformas | Planejamento e execução dos empreendimentos | Parcial |
| `orcamentos` | Orçamentos e Composições | EAP, custos, BDI, cronograma e revisões | Existente |
| `bases-precos` | Bases de Preços | Fontes, publicações, insumos e composições | Existente |
| `suprimentos` | Suprimentos e Contratações | Planejamento, pesquisa de preços, seleção e aquisição | Parcial |
| `contratos` | Contratos | Instrumentos, saldos, vigência, aditivos e fiscalização | Planejado |
| `financeiro` | Financeiro-Orçamentário | Orçamento, compromissos, execução e pagamentos | Planejado |
| `medicoes` | Medições e Fiscalização | Boletins, evidências, glosas, aceite e evolução | Existente |
| `manutencao` | Manutenção e Facilities | Chamados, planos, ordens de serviço, SLA e custos | Parcial |
| `regularidade` | Regularidade e Compliance | PPCI, licenças, ART/RRT, riscos e vencimentos | Parcial em `ppci` |
| `utilidades` | Consumos e Utilidades | Água, energia, gás, resíduos, metas e anomalias | Parcial |
| `convenios` | Convênios e Repasses | Instrumentos, metas, repasses e prestação de contas | Planejado |
| `documentos` | Documentos e GED | Arquivos, versões, protocolo, aprovação e assinatura | Fundação planejada |
| `relatorios` | BI, Relatórios e Transparência | Indicadores, análises e publicações autorizadas | Parcial |
| `administracao` | Administração | Configuração, segurança, auditoria e integrações | Existente |

Os IDs planejados somente devem entrar no catálogo executável quando o módulo
tiver permissões, rotas, migração e uma experiência mínima segura. A documentação
do produto pode antecipar o planejamento sem habilitar funcionalidades vazias.

## Perfis de organização

Cada organização deve possuir um perfil configurável:

- `publico`: administração pública e seus fluxos orçamentários e de contratação;
- `federacao`: federações, conselhos, associações e entidades semelhantes;
- `privado`: empresas e gestores privados;
- `escritorio`: escritórios de engenharia e arquitetura;
- `facilities`: operadores especializados em patrimônio e manutenção.

O perfil controla terminologia, modelos e fluxos iniciais. Ele não substitui
permissões, licenças ou regras jurídicas configuradas para a organização.

Regras específicas de contratação pública não podem ser fixadas para todas as
organizações. A aplicabilidade deve ser configurável e auditável.

## Edições e módulos avulsos

| Edição comercial | Composição de referência |
|---|---|
| PRUMO Orçamentos | Orçamentos, Bases de Preços e Relatórios |
| PRUMO Obras | Orçamentos, Obras, Medições e Documentos |
| PRUMO Facilities | Patrimônio, Manutenção, Utilidades e Documentos |
| PRUMO Suprimentos | Suprimentos, Contratos e Fornecedores compartilhados |
| PRUMO ERP | Planejamento, Suprimentos, Contratos e Financeiro |
| PRUMO Governança | Patrimônio, Regularidade, Convênios, GED e Auditoria |
| PRUMO Governo | Governança, Contratações, Obras, Medições e Financeiro-Orçamentário |
| PRUMO Enterprise | Todos os módulos contratados pela organização |

As edições são pacotes comerciais. A organização pode adicionar ou remover
módulos sem migrar para outro produto ou duplicar cadastros.

## Licenciamento e autorização

O acesso efetivo deve resultar de três verificações independentes:

1. a licença ou capacidade habilita o módulo para a organização;
2. o perfil e as permissões autorizam a ação do usuário;
3. as políticas de isolamento limitam os registros que podem ser acessados.

Desabilitar um item de menu não é controle de licença. Frontend, API, tarefas,
relatórios, exportações e integrações devem aplicar as mesmas capacidades.

Estruturas previstas para a Sprint 10.6:

- catálogo versionado de módulos e funcionalidades;
- capacidades habilitadas por organização;
- dependências obrigatórias e opcionais;
- pacotes comerciais e limites contratados;
- flags para liberação gradual;
- histórico auditável de ativação e desativação.

## Dependências principais

- qualquer módulo depende do núcleo compartilhado;
- Obras reutiliza Patrimônio, Orçamentos e Documentos quando contratados;
- Suprimentos reutiliza fornecedores, Orçamentos e Planejamento;
- Contratos recebe resultados de Suprimentos e alimenta Medições e Financeiro;
- Financeiro recebe compromissos de pedidos, contratos e medições;
- Manutenção reutiliza Patrimônio, ativos, Contratos e Documentos;
- Convênios relaciona planejamento, fontes de recurso, contratos e execução;
- BI somente apresenta dados autorizados dos módulos habilitados.

Cadastros de cliente, site, prédio, sala, fornecedor, contrato, documento ou
usuário não devem ser duplicados entre módulos.
