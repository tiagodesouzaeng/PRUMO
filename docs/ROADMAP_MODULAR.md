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
| 13 | Suprimentos e contratações | Planejamento, estudos, riscos, pesquisa de preços, seleção, pedido e recebimento |
| 14 | Contratos | Instrumentos, atas, saldos, vigência, fiscais, aditivos, garantias e encerramento |
| 15 | Financeiro-orçamentário | Planejamento, fontes, compromissos, execução, retenções e pagamentos |
| 16 | Obras e medições corporativas | Consolidação dos recursos existentes com execução, evidências e aceite |
| 17 | Manutenção e facilities | Chamados, planos preventivos, ordens, SLA, ativos, equipes e custos |
| 18 | Convênios e prestação de contas | Instrumentos, metas, contrapartidas, repasses, execução e comprovação |
| 19 | Compliance e transparência | Regularidade, riscos, auditoria, controles, dados e relatórios públicos |
| 20 | BI, portais e consolidação | Indicadores executivos, portais, integrações e prontidão comercial ampliada |

As Sprints 10.4 e 10.5 preservam o escopo já aprovado. A Sprint 10.6 formaliza
a convergência comercial antes da criação dos novos domínios transacionais.

As Sprints 10.4, 10.5 e 10.6 estão concluídas localmente na versão `10.6.0`.
A próxima etapa executável é a Sprint 11, mantendo como hierarquia canônica
`Cliente > Site > Prédio > Sala`.

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
