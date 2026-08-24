# Roadmap modular do PRUMO

## Direção

Este roadmap converge PRUMO ERP e PRUMO Governança em uma única plataforma.
Os módulos são contratáveis separadamente e reutilizam o mesmo núcleo, banco,
cadastros e políticas de segurança.

Referências:

- `docs/arquitetura/PLATAFORMA_MULTIMODULO.md`;
- `docs/arquitetura/CATALOGO_MODULOS.md`;
- `docs/SPRINT_10.md`;
- `BACKLOG_PRUMO.md`.

## Premissas permanentes

- produto, base de código e modelo corporativo únicos;
- público prioritário: setor público, federações e entidades distribuídas;
- perfis configuráveis para público, federação, privado, escritório e facilities;
- hierarquia física canônica `Cliente > Site > Prédio > Sala`;
- módulos independentes comercialmente e integrados por contratos explícitos;
- licença, permissão e isolamento de dados são controles diferentes;
- dados técnicos e gerenciais pertencem ao PRUMO; sistemas fiscais, contábeis,
  trabalhistas e oficiais devem ser integrados quando essa opção for mais segura;
- nenhuma funcionalidade futura entra no catálogo executável sem rotas,
  permissões, persistência e experiência mínima coerentes.

## Sequência de entregas

| Sprint | Tema | Resultado esperado |
|---|---|---|
| 10.4 | Auditoria e governança | Trilha imutável, consulta, exportação, retenção e recuperação verificadas |
| 10.5 | Documentos e integrações | Fundação corporativa do GED, anexos e credenciais seguras |
| 10.6 | Produto modular | Licenças, capacidades, dependências, perfis de organização e bloqueio integral |
| 11 | Cadastro patrimonial | Cliente, site, prédio, sala, ativos, áreas, responsáveis e histórico |
| 12 | Demandas e investimentos | Solicitações, priorização, carteira, programas, plano anual e aprovações |
| 12.1 | Consolidação administrativa | Governança real de módulos, perfis, integrações, operação e auditoria |
| 13 | Suprimentos e contratações | Planejamento, estudos, riscos, pesquisa de preços, seleção, pedido e recebimento |
| 14 | Contratos | Instrumentos, atas, saldos, vigência, fiscais, aditivos, garantias e encerramento |
| 15 | Financeiro-orçamentário | Planejamento, fontes, compromissos, execução, retenções e pagamentos |
| 16 | Obras e medições corporativas | Consolidação dos recursos existentes com execução, evidências e aceite |
| 17 | Manutenção e facilities | Chamados, planos preventivos, ordens, SLA, ativos, equipes e custos |
| 18 | Convênios e prestação de contas | Instrumentos, metas, contrapartidas, repasses, execução e comprovação |
| 19 | Compliance e transparência | Regularidade, riscos, auditoria, controles, dados e relatórios públicos |
| 20 | BI, portais e consolidação | Indicadores executivos, portais, integrações e prontidão comercial ampliada |
| 20.1 | Estabilização integrada | Roadmap gerencial, telas sem rótulos de desenvolvimento, segurança de dependências e validação completa |
| 21 | Prontidão de produção | OIDC, contexto global Cliente > Site > Prédio > Sala, exclusão segura de Sites, base de homologação multiempresa, migração definitiva e endurecimento |
| 22 | Consolidação local | Homologação assistida, repositórios híbridos e propagação do contexto patrimonial |
| 23 | Fundação do piloto | OIDC obrigatório, GED S3, readiness, segurança e runbook operacional |
| 24 | Ambiente corporativo | Prontidão verificável por organização, HTTPS, identidade, dados, GED, recuperação e monitoramento |
| 25 | Migração e piloto assistido | Evidências, isolamento, transição de repositórios, retorno seguro, aceite e promoção controlada |
| 26/26.1 | Segurança e consolidação | Acesso obrigatório, contingência protegida e módulos correlatos consolidados |
| 27 | Execução contratual | Base contratada imutável, medições por saldo e aditivos governados |
| 28 | Governança documental | Documentos obrigatoriamente ligados à origem, com revisão, aprovação e rastreabilidade |

As Sprints 10.4 e 10.5 preservam o escopo já aprovado. A Sprint 10.6 formaliza
a convergência comercial antes da criação dos novos domínios transacionais.

As Sprints 10.4 a 20 estão concluídas localmente. A versão `20.1.0` inicia a
homologação integrada, centraliza este roadmap no módulo de Auditoria e remove
das telas operacionais os rótulos internos de desenvolvimento. A etapa seguinte
concentra identidade corporativa, migração definitiva, endurecimento de produção
e preparação comercial, sem publicação automática.

## Sprint 10.4 — Auditoria e governança

- eventos com organização, equipe, usuário, módulo, ação e data;
- estado anterior e posterior com tratamento de campos sensíveis;
- trilha imutável para aprovações, revisões, exclusões e transições;
- consulta e exportação administrativas por permissão;
- política de retenção;
- backup e restauração com teste de recuperação;
- decisões arquiteturais de licenciamento, capacidades e perfis registradas.

## Sprint 10.5 — Documentos e integrações

- metadados e armazenamento corporativo de arquivos;
- anexos de medições e documentos técnicos;
- vínculo polimórfico seguro com entidades dos módulos;
- versão, hash, responsável e histórico;
- credenciais protegidas para integrações;
- sincronizações executadas no servidor e auditadas.

## Sprint 10.6 — Produto modular

- distinguir módulo disponível, contratado, habilitado e permitido;
- definir catálogo de funcionalidades e dependências;
- habilitar módulos por organização sem nova implantação;
- bloquear capacidades no frontend, API, tarefas, relatórios e integrações;
- configurar perfis de organização e terminologia inicial;
- registrar ativação, suspensão e alteração de pacote na auditoria;
- preparar pacotes comerciais sem acoplar cobrança às regras de domínio.

## Sprints 11 e 12 — Fundação operacional

A Sprint 11 estabelece a fonte única da estrutura física. A Sprint 12 cria a
entrada controlada de demandas e a carteira de investimentos. Nenhum módulo deve
criar estruturas paralelas de cliente, site, prédio ou sala.

### Sprint 11 — concluída localmente

- árvore patrimonial validada no PostgreSQL;
- ativos vinculados a salas e movimentações imutáveis;
- áreas, endereços, responsáveis, ocupação, situação e controle de versão;
- RLS por empresa e equipe, permissões, auditoria e dependência modular;
- referência patrimonial disponível para empreendimentos e documentos;
- interface operacional, testes, backup e restauração aprovados.

### Sprint 12 — concluída localmente

- demandas vinculadas à hierarquia patrimonial canônica;
- priorização ponderada por urgência, impacto, risco e alinhamento;
- programas estratégicos e carteiras anuais com limite financeiro;
- fluxo de análise, priorização, aprovação, rejeição e incorporação;
- decisões imutáveis, controle de versão, idempotência e auditoria;
- RLS por empresa e equipe, API, interface e testes reais no PostgreSQL.

### Sprint 12.1 — concluída localmente

- Administração reduzida a sete áreas de governança com contratos reais;
- visão operacional conectada à API e sem indicadores fictícios;
- módulos, capacidades, dependências, perfis e permissões canônicos;
- cadastros demonstrativos e ações sem implementação removidos da navegação;
- fronteira explícita entre Administração e operação cotidiana dos módulos.

### Sprint 13 — concluída localmente

- fornecedores compartilhados e qualificados;
- processos originados por demanda incorporada ou orçamento;
- estudo técnico, riscos e termo de referência;
- pesquisa de preços, propostas, julgamento e aprovação;
- pedidos, recebimentos, aceite e conclusão;
- RLS, permissões segregadas, idempotência e trilha imutável.

### Sprint 14 — concluída localmente

- instrumentos originados por processo aprovado e fornecedor vencedor;
- contratos, atas, vigência, valores, execução e saldo;
- gestores, fiscais, garantias, aditivos, reajustes e supressões;
- ocorrências, sanções e histórico decisório imutável;
- conclusão, rescisão e encerramento auditáveis;
- RLS, permissões segregadas, API, interface e testes reais no PostgreSQL.

## Sprints 13 a 15 — Ciclo administrativo e financeiro

Fluxo prioritário:

`Demanda > Planejamento > Contratação > Contrato > Medição/Recebimento > Execução financeira`

As regras devem aceitar variações por organização. Termos como dotação, empenho
e liquidação pertencem ao perfil público; orçamento empresarial, compromisso e
aprovação de pagamento podem ser apresentados aos demais perfis sobre contratos
de domínio compatíveis.

## Sprints 16 e 17 — Execução e operação

Essas sprints consolidam recursos visuais e locais já existentes, conectando-os
ao PostgreSQL, à hierarquia patrimonial, aos documentos e aos contratos. Não são
reescritas integrais dos módulos atuais.

### Sprint 16 — concluída localmente

- carteira corporativa de obras ligada a patrimônio, contrato e orçamento;
- cronograma físico-financeiro, diário, efetivo, ocorrências e evidências;
- boletins com itens, retenções, glosas, multas, aprovação e aceite;
- saldo a medir, progresso físico e financeiro e integração preparada com o Financeiro;
- RLS, permissões segregadas, auditoria, versão e idempotência.

### Sprint 17 — concluída localmente

- chamados corretivos, preventivos, inspeções e melhorias;
- SLA por prioridade, triagem, programação, execução, solução e aceite;
- planos preventivos vinculados a espaços e ativos patrimoniais;
- ordens de serviço com equipes, fornecedores, materiais, mão de obra e custos;
- RLS, permissões segregadas, auditoria, versão e idempotência.

## Sprints 18 a 20 — Prestação de contas e escala

O ciclo final amplia convênios, regularidade, transparência, indicadores,
portais e integrações. A prontidão comercial deve incluir testes de isolamento,
recuperação, atualização, observabilidade e operação por módulo.

## Critério de passagem entre sprints

Uma sprint de domínio somente pode ser encerrada quando possuir, no mínimo:

- modelo e migração versionada;
- política RLS e teste entre organizações;
- permissões e capacidades do módulo;
- API e validação de entrada;
- auditoria das ações relevantes;
- testes automatizados proporcionais ao risco;
- documentação operacional e estratégia de backup;
- integração explícita, quando consumir ou publicar dados de outro módulo.

## Sprints 21 a 25 — Homologação e operação assistida

A versão `22.0.0` conclui localmente o contexto Cliente → Site → Prédio → Sala,
a exclusão segura, a massa de três organizações fictícias e a homologação
assistida dos dados locais. A versão 23.0.0 conclui a fundação do piloto:
contrato OIDC obrigatório em produção, storage GED S3 compatível com URLs
temporárias, prontidão operacional, endurecimento de segurança e runbook de
entrada controlada. A ativação pública continua condicionada à contratação e
configuração dos serviços externos de identidade, API, PostgreSQL e storage.

As versões 24.0.0 e 25.0.0 acrescentam a governança operacional que faltava:
cada requisito de infraestrutura, migração e piloto possui estado, evidência,
responsável e data por organização. O início do piloto é bloqueado enquanto a
Sprint 24 não estiver comprovada e a promoção é bloqueada até todos os requisitos
da Sprint 25 serem aprovados. A contratação e a configuração dos serviços
externos continuam sendo ações de implantação, não credenciais do código-fonte.

## Sprints 26 e 26.1 — Segurança e consolidação do produto

A versão `26.1.0` impede o carregamento do produto sem uma sessão válida e
oferece contingência administrativa local protegida para homologação. A
integração corporativa OIDC/JWT permanece a identidade principal e depende da
configuração externa do provedor e de MFA para produção.

A navegação passa a refletir o produto comercial modular: PPCI integra
Regularidade, alertas integram a Visão geral, bases de preços integram
Orçamentos, e sua publicação central fica na Administração. Consumos evoluem
para Utilidades, Energia e Consumos, enquanto Demandas recebe o nome operacional
Solicitações e Investimentos.

## Sprint 27 — Orçamento contratado e aditivos governados

A versão `27.0.0` separa definitivamente o orçamento publicado da execução
contratual. A homologação do resultado da licitação cria uma base imutável com
os preços unitários vencedores, aplicando o desconto linear informado sem
reescrever a memória, a revisão ou os valores originais do orçamento.

Obras novas passam a exigir vínculos com orçamento e contrato. Medições usam a
base contratada e não podem superar seu saldo. Necessidades supervenientes da
fiscalização são registradas como solicitações de aditivo e percorrem submissão,
análise, aprovação ou rejeição pela engenharia de custos antes de qualquer
conversão em revisão contratual.

## Sprint 28 — Governança documental por entidade

A versão `28.0.0` elimina a criação de registros documentais órfãos. O usuário
seleciona uma entidade existente e acessível no PostgreSQL; esse vínculo é
registrado como origem principal e não pode ser omitido. Relações adicionais
permitem reutilizar o mesmo arquivo sem cópias entre patrimônio, solicitações,
orçamentos, contratações, contratos, obras, medições, manutenção, regularidade
e convênios. Versões permanecem imutáveis e o estado percorre rascunho, revisão,
aprovação e arquivamento com controle de concorrência e auditoria.

## Sprint 29 — Promoção verificável dos repositórios

A versão `29.0.0` permite promover Orçamentos do modo híbrido para o modo
corporativo somente depois de uma comparação integral entre o acervo do
navegador e o PostgreSQL. A evidência registra quantidades, identificadores,
hashes e divergências sob RLS e permanece imutável.

A promoção exige evidência conforme emitida nas últimas 24 horas e a versão
corrente da decisão administrativa. O retorno ao híbrido exige justificativa,
é auditado e não apaga nenhuma fonte. Composições próprias, bases de preços e
configurações continuam híbridas até receberem validadores específicos.

## Sprint 30 — PPCI local e segurança predial

A versão `30.0.0` substitui definitivamente a integração histórica do PPCI por
persistência PostgreSQL própria. O cadastro de cada processo exige um Site,
Prédio ou Sala ativo da hierarquia patrimonial; sistemas preventivos podem
detalhar ambientes descendentes e ativos cadastrados na Sala correspondente.

PPCI passa a compartilhar a experiência de Regularidade com licenças,
ART/RRT, riscos, controles, auditorias e transparência. Inspeções são
imutáveis, vencimentos alimentam a Visão geral e todas as tabelas aplicam RLS
por empresa e equipe, com auditoria para criação, alteração e inspeção.

## Sprint 31 — PPCI operacional e utilidades mensuráveis

A versão `31.0.0` completa a operação dos sistemas preventivos: edição,
remoção rastreável, responsáveis do cliente ativo e abertura contextual do GED.
Inspeções continuam imutáveis e impedem a perda do sistema associado.

Utilidades passa a possuir medidores patrimoniais reais para água, energia,
gás, combustíveis e outros recursos. Leituras de consumo, geração, crédito e
débito ficam no PostgreSQL com RLS, auditoria e permissões segregadas.
Patrimônio passa a explicar falhas de cadastro dentro do próprio formulário e
Solicitações/Carteiras recebem edição e detalhamento operacional.

## Sprint 32 — Operação de campo e manutenção preventiva

Planejada para a versão `32.0.0`, aprimora o diálogo do PPCI, corrige a
remoção de sistemas e oferece anulação auditada de inspeções. Utilidades passa
a aceitar consumo informado diretamente ou leitura acumulada do relógio, com
memória do cálculo baseada na última leitura válida anterior e uma interface
de coleta simplificada para equipes de campo.

O Site torna-se a fonte única do endereço físico para seus Prédios e Salas e
recebe a ação de copiar o endereço do Cliente. Ativos passam a possuir planos
periódicos que geram previsões e ordens sem duplicidade no módulo Manutenção,
com navegação entre equipamento, intervenções futuras e histórico executado.
Metas, tarifas, faturas, alertas e importação de leituras complementam a
evolução estratégica de Utilidades. O detalhamento e os critérios de aceite
estão em `docs/SPRINT_32.md`.
