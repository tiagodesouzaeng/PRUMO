# PRUMO — Plataforma modular de engenharia e governança

Pacote completo baseado no `src` histórico do SIGIU v8.2.0 RC1, atualizado
visualmente para PRUMO e acrescido do módulo de Orçamentos.

## Direção do produto

O PRUMO evolui como um produto único e modular para governança de patrimônio,
obras, contratos, serviços e investimentos, com prioridade para setor público,
federações e organizações distribuídas. `PRUMO ERP` e `PRUMO Governança` são
edições comerciais da mesma plataforma, com módulos contratáveis separadamente.

- arquitetura permanente: `docs/arquitetura/PLATAFORMA_MULTIMODULO.md`;
- catálogo funcional e comercial: `docs/arquitetura/CATALOGO_MODULOS.md`;
- roadmap após a v10.3.0: `docs/ROADMAP_MODULAR.md`;
- operação de backup e restauração: `docs/operacao/BACKUP_RESTAURACAO_POSTGRESQL.md`;
- acessos locais PostgreSQL e Git: `docs/operacao/ACESSOS_DESENVOLVIMENTO.md`;
- backlog permanente: `BACKLOG_PRUMO.md`.

## Conteúdo integrado

- base histórica: PPCI, alertas, consumo hídrico, obras, manutenção,
  relatórios e administração;
- novo módulo de Orçamentos no menu lateral e na navegação móvel;
- planilha orçamentária e EAP;
- bases de preços versionadas e independentes dos orçamentos;
- BDI, encargos e indicadores;
- cronograma físico-financeiro;
- histograma de mão de obra;
- medições, saldos e revisões;
- múltiplos orçamentos e revisões imutáveis.

## Persistência local — v9.1

- criação de novos orçamentos;
- inclusão e exclusão de serviços;
- cálculos automáticos de custo direto, BDI, preço total e valor por área;
- totais de grupos calculados pela EAP;
- criação de revisões;
- exportação do orçamento em JSON;
- restauração dos dados e do orçamento ativo após recarregar a aplicação.

## Motor orçamentário — v9.2

- edição, duplicação, exclusão e ordenação de itens;
- criação e manutenção de grupos da EAP;
- exclusão controlada de grupos e seus serviços;
- BDI detalhado por componentes e memória de cálculo;
- cadastro de composições próprias;
- importação de planilhas CSV, XLS e XLSX;
- validação de códigos, descrições, quantidades, preços e unidades;
- comparação de snapshots entre revisões;
- remoção completa das referências fixas à marca ULBRA.

## Integração SINAPI — v9.3

- número do serviço gerado automaticamente após selecionar o grupo da EAP;
- serviço inserido automaticamente dentro do grupo selecionado;
- criação rápida de grupo dentro do cadastro do serviço;
- importação das publicações oficiais em ZIP, XLSX ou XLS;
- bases separadas por UF, referência mensal e regime;
- armazenamento estruturado em IndexedDB;
- hash SHA-256 do arquivo importado;
- catálogo pesquisável de composições no cadastro do serviço;
- alerta e bloqueio de atualização para referências com preço zerado;
- atualização dos preços dos serviços vinculados à base ativa.

## Correção e generalização das bases de preços — v9.4.1

- leitura do pacote ZIP completo publicado pela CAIXA, incluindo referência,
  famílias e coeficientes, manutenções e mão de obra;
- reconhecimento dos cabeçalhos oficiais em linhas variáveis e dos códigos de
  composições armazenados em fórmulas de hiperlink;
- catálogo unificado de insumos e composições, com vínculos analíticos
  preservados para consulta sob demanda;
- importador genérico para PLEO, SBC, ORSE e futuras bases tabulares;
- bases de preços persistidas fora dos orçamentos;
- escolha explícita da base e da referência em cada serviço;
- composições próprias formadas por insumos ou composições de qualquer base
  importada;
- atualização dos itens e componentes próprios quando uma nova versão da base
  for aplicada.

## EAP e biblioteca de composições — v9.4.2

- reclassificação automática dos códigos ao subir ou descer itens;
- reposicionamento físico do serviço quando sua classificação é alterada;
- cinco níveis de classificação: Site, Prédio, Andar, Sala e Disciplina;
- submódulo independente de Bases de Preços abaixo de Orçamentos;
- biblioteca separada de composições e insumos por base, mês e estado;
- composições SINAPI sintéticas e analíticas disponíveis no catálogo;
- memória da composição aberta ao clicar no serviço do orçamento;
- apresentação de insumos, composições auxiliares, coeficientes, preços e bases
  de origem;
- editor em modal para composições próprias;
- Base própria PRUMO independente dos orçamentos;
- componentes próprios atualizados quando a mesma publicação externa for
  reimportada.

## Motor financeiro — v9.4

- preços unitários com precisão superior a duas casas decimais;
- preservação da precisão original para cadastro, importação e memória;
- truncamento obrigatório, sem arredondamento, após a segunda casa decimal;
- desconto global informado como percentual ou valor monetário;
- cálculo automático do percentual quando o desconto for informado em valor;
- distribuição e auditoria do desconto em cada serviço do orçamento;
- controle do resíduo de centavos para fechamento exato do desconto global;
- apresentação dos valores bruto, descontado e líquido por serviço e grupo;
- aplicação do BDI sobre o custo direto líquido;
- preservação da regra financeira e dos totais nas novas revisões.

## Homologação de composições e preços — v9.4.7

- regra estadual e fallback para SP centralizados e testados;
- consolidação de publicações SINAPI antigas separadas por estado;
- detecção de ciclos durante a navegação recursiva das composições;
- validação de códigos, tipos, coeficientes e preços dos componentes;
- sinalização de referências sem composição analítica;
- destaques de rastreabilidade incompleta no modal;
- testes automatizados para preços estaduais e qualidade das composições.

## Governança e carteira de orçamentos — v9.4.8

- dashboard geral antes da abertura de um orçamento, com estatísticas, gráficos,
  pendências de validação e situação das aprovações;
- seleção explícita do orçamento antes de acessar planilha, BDI, cronograma,
  medições, condições comerciais e revisões;
- navegação bidirecional entre revisões, permitindo retroceder e avançar sem
  perder o estado editável da revisão atual;
- inativação, reativação e exclusão de revisões históricas, protegendo sempre a
  revisão ativa;
- arquivamento, restauração e exclusão definitiva das bases transferidos para o
  módulo Administração;
- exclusão unitária remove catálogo, composições analíticas e arquivo-fonte da
  publicação selecionada.

## Licitações e concorrência — v9.5

- submódulo integrado ao orçamento para geração do pacote da concorrência;
- arquivo XLSX único com abas de instruções, orçamento completo, proposta de
  preços, BDI e encargos, cronograma e histograma;
- fórmulas protegidas e células de preenchimento explicitamente desbloqueadas;
- cálculos compatíveis com o truncamento monetário da v9.4;
- identificação da revisão, bases utilizadas pelos itens e versão do arquivo distribuído;
- filtros e congelamento de painéis preparados para uso;
- cronograma e histograma de mão de obra vinculados por fórmulas;
- arquivo preparado para recálculo automático ao abrir no Excel.

## EAP e planejamento da obra nas licitações — v9.5.1

- prazo contratual definido por data de início e conclusão no orçamento;
- intervalo de medição configurável em dias, com recomendação inicial de 30 dias;
- períodos gerados de forma contínua até a data final, inclusive quando o último
  período for menor que o intervalo padrão;
- identificação dos cinco níveis da EAP — Site, Prédio, Andar, Sala e Disciplina —
  nas abas Orçamento Completo, Proposta de Preços, Cronograma e Histograma;
- cronograma e histograma dimensionados conforme os períodos reais de medição;
- prazo e frequência de medição identificados em todas as abas do pacote.

## Identidade visual e integrações assistidas — v9.6

- logotipo oficial do PRUMO aplicado no menu lateral e no cabeçalho móvel;
- identidade textual atualizada nas áreas administrativas e de navegação;
- central de integrações para SINAPI, PLEO, SBC e ORSE;
- configuração de URL direta para publicações ZIP, XLSX, XLS ou CSV;
- validação de HTTPS, formato e tamanho antes da importação;
- download e processamento pelo mesmo importador versionado das bases manuais;
- referência, estado, regime e periodicidade configuráveis por fonte;
- preservação do hash e da cópia interna do arquivo pelo repositório existente;
- auditoria local das tentativas e resultados de integração;
- estrutura preparada para execução agendada por backend quando houver uma API
  oficial estável ou serviço corporativo.

## Correção do XLSX e suprimentos — v9.7

- correção da exportação do pacote de licitação quando o histograma não possui
  recurso associado a uma hierarquia EAP;
- download mais estável por meio de vínculo temporário anexado ao documento;
- teste de regressão para orçamento sem composição analítica de mão de obra;
- nova etapa `Suprimentos` dentro do orçamento;
- explosão recursiva de composições próprias e importadas;
- consolidação dos insumos por base, código e unidade;
- memória das quantidades, preços básicos, valores estimados e serviços de origem;
- detecção de ciclos, referências sem preço e composições sem memória analítica;
- pendências mantidas visíveis para impedir omissão silenciosa de demanda.

## Planejamento e medições — v9.8

- reorganização das planilhas de licitação conforme a hierarquia da EAP;
- referência da base, mão de obra, material e custo unitário no orçamento;
- totalização recursiva das linhas da EAP;
- cronograma alinhado às linhas e aos valores do orçamento;
- prazo da obra em dias corridos com cálculo bidirecional das datas;
- medições propostas conforme o cronograma, editadas por quantidades;
- retenções, multas, motivos e relação de documentos exigidos.

## Cronograma de aquisições — v9.9

- distribuição dos insumos conforme a execução mensal dos serviços;
- antecedência padrão e configuração individual por insumo;
- cálculo da data recomendada de compra;
- separação da mão de obra da relação de materiais;
- rastreabilidade entre serviço, composição e demanda do insumo.

## Cobertura operacional — v9.10

- estoque disponível, pedidos emitidos e entregas programadas;
- projeção de saldo, falta e risco de ruptura por período;
- validação técnica realizada por testes automatizados e relatórios apresentados
  externamente, sem formulário dentro do aplicativo.

## Encerramento técnico da Etapa 9 — v9.11

- recolhimento independente de grupos da EAP em todos os níveis do cronograma;
- ações gerais e por linha para limpar o cronograma e distribuir o saldo
  exclusivamente nos períodos vazios, preservando zeros informados;
- percentuais exibidos com duas casas, preservando a precisão digitada;
- períodos identificados por mês, dias acumulados e intervalo exato de datas;
- histograma com descrições quebradas, colunas alinhadas e total de horas;
- limpeza e distribuição de saldo geral e por função também disponíveis no
  histograma;
- histograma limitado a quantidades inteiras de pessoas, preservando zeros e
  permitindo valores manuais acima da sugestão automática;
- medições com quantidade e valor acumulados, saldo após a medição e bloqueio
  defensivo quando um item ultrapassa 100% do contratado;
- alteração explícita do status no cabeçalho do orçamento, com validação das
  pendências antes da aprovação;
- perdas técnicas e fatores de conversão configuráveis por insumo;
- equivalência e substituição por código, descrição, unidade, base e preço;
- justificativa técnica e preservação das referências originais;
- relatório XLSX de suprimentos com abas Resumo, Demanda, Calendário,
  Cobertura, Cotação, Pedidos e Pendências;
- células protegidas e campos de cotação e acompanhamento desbloqueados;
- atualização segura do roteiro padrão nos orçamentos já existentes;
- atualização das bibliotecas de planilha e correção das vulnerabilidades
  conhecidas pela auditoria de dependências;
- etapa liberada como RC1 para homologação do usuário.

## Sprint 10 — plataforma corporativa

O incremento 10.1 iniciou a preparação para API, autenticação, banco central e
auditoria sem interromper a persistência local existente. O incremento 10.2
acrescenta a fundação de sessão em memória, seis perfis corporativos e uma
matriz de permissões no módulo Administração. A autenticação real continuará
dependente da futura API e do provedor de identidade.

Como entrega complementar da v10.2, o orçamento passa a admitir BDI
diferenciado por item. A taxa reduzida somente é aplicada quando os requisitos
técnicos e jurídicos estiverem integralmente declarados; itens incompletos
permanecem com o BDI normal. O pacote de licitação preserva as duas composições,
as fórmulas aplicáveis e a memória de justificativa.

O incremento 10.3 DEV1 introduz a fundação multiempresa: empresas, equipes,
vínculos, propriedade dos registros, contexto corporativo nas chamadas da API,
idempotência, controle de concorrência e pacotes de migração com hash. O módulo
Administração apresenta a classificação dos dados e o plano de migração. A
referência das políticas PostgreSQL está em
`docs/arquitetura/MULTIEMPRESA_POSTGRESQL.sql`.

O incremento 10.3 DEV2 acrescenta uma API executável, autenticação OIDC
substituível, adaptador PostgreSQL, migração inicial, segurança por linha,
idempotência e controle de concorrência. O modo em memória existe somente para
desenvolvimento; a configuração de produção exige PostgreSQL e provedor OIDC.

O PRUMO permanece uma plataforma multimódulo. A fundação corporativa da Sprint
10 é compartilhada por Obras, Manutenção, PPCI, Orçamentos, Bases de Preços,
Suprimentos, Medições, Administração, GED e módulos futuros. A diretriz
permanente está em `docs/arquitetura/PLATAFORMA_MULTIMODULO.md`.

Na DEV3, o catálogo dos módulos passou a ser compartilhado entre frontend e
backend. A API também recebeu empreendimentos, revisões, medições, permissões
por módulo e eventos de integração. A segunda migração PostgreSQL está em
`server/migrations/002_nucleo_multimodulo.sql`.

As DEV4 e DEV5 ativam o catálogo corporativo e a migração assistida no
PostgreSQL real. Bases, publicações, preços por UF, componentes analíticos e
composições próprias possuem persistência e RLS. Os dados locais podem ser
enviados para uma área temporária, validados por hash e contagens e homologados
transacionalmente. A estrutura está em
`server/migrations/003_catalogo_e_migracao_assistida.sql`.

As DEV6 e DEV7 acrescentam uma fila durável para importações e cálculos, além
da transição reversível dos repositórios. Após a homologação, cada domínio
começa em modo híbrido; o PostgreSQL só se torna a fonte principal mediante
confirmação administrativa. A estrutura está em
`server/migrations/004_fila_e_transicao_repositorios.sql`.

A versão `10.3.0` encerra esta fundação com testes reais de invasão entre
empresas e equipes, recuperação de trabalhos pendentes e reprocessamento
controlado de falhas.

O incremento 10.4 DEV1 adiciona auditoria corporativa imutável, consulta e
exportação administrativa, política de retenção e ferramentas operacionais de
backup e restauração. A versão `10.4.0` encerra o incremento após a geração de
uma cópia completa, verificação de integridade e restauração integral aprovada
em banco descartável.

A versão `10.6.0` conclui as duas etapas seguintes. A fundação do GED mantém
documentos, versões imutáveis, hash e referências seguras de armazenamento no
PostgreSQL. O produto modular separa catálogo, contrato, habilitação e permissão
por empresa, com capacidades, dependências e perfis de organização. A navegação
lateral agora possui rolagem própria e recolhimento para ícones, evitando que a
Administração fique encoberta pela barra do sistema operacional.

O fechamento integral da Sprint 10 adiciona vínculos de anexos técnicos,
registro assistido de versões, sincronizações de integrações executadas pelo
worker e personalização inicial de terminologia por organização. A migração 011
elevou a validação para 100 testes aprovados no ambiente local.

A versão `11.0.0` conclui o cadastro patrimonial canônico. O novo módulo
Patrimônio mantém `Cliente > Site > Prédio > Sala`, ativos e movimentações no
PostgreSQL com RLS por empresa/equipe, permissões, auditoria e controle de
versão. Empreendimentos e documentos já podem referenciar os mesmos
identificadores. O fechamento possui 109 testes aprovados e backup restaurado
após 16 migrações. Consulte `docs/SPRINT_11.md`.

A versão `12.0.0` conclui Demandas e Investimentos. Necessidades vinculadas ao
patrimônio percorrem análise, priorização e aprovação auditáveis antes de
integrarem programas e carteiras anuais com limite financeiro. O fechamento
possui 120 testes aprovados e 19 migrações. Consulte `docs/SPRINT_12.md`.

A versão `12.1.0` consolida a Administração como centro de governança. Abas e
ações demonstrativas foram retiradas, o resumo passou a usar dados reais da API
e módulos, capacidades, perfis, integrações, operação técnica e auditoria foram
organizados em sete áreas produtivas. O fechamento possui 122 testes aprovados,
sem nova migração. Consulte `docs/SPRINT_12_1.md`.

A versão `13.0.0` conclui Suprimentos e Contratações. Demandas incorporadas e
orçamentos originam processos com estudo técnico, riscos, termo de referência,
pesquisa de preços, julgamento, pedidos e recebimentos. O fechamento possui 127
testes aprovados e 20 migrações. Consulte `docs/SPRINT_13.md`.

A versão `13.1.0` unifica a apresentação de toda a plataforma. Orçamentos passa
a ser a referência de densidade visual, com paleta, tipografia, cabeçalhos,
indicadores, cartões, botões, formulários, abas, tabelas e modais governados pelo
mesmo design system. O fechamento possui 129 testes aprovados, sem nova
migração. Consulte `docs/DESIGN_SYSTEM_PRUMO.md`.

A versão `14.0.0` conclui Contratos e Atas. Processos aprovados originam
instrumentos com vigência, valores, saldo, gestores, fiscais, garantias,
aditivos, execução, ocorrências, sanções e encerramento. O fechamento possui
134 testes aprovados e 21 migrações. Consulte `docs/SPRINT_14.md`.

A versão `15.0.0` conclui o Financeiro-orçamentário. Centros de custo, fontes e
orçamentos CAPEX/OPEX suportam compromissos originados por pedidos, contratos,
medições ou registro manual. Reserva, compromisso/empenho, liquidação/aprovação,
retenções, glosas, pagamentos e conciliação usam terminologia por perfil,
controle de saldo, RLS e histórico imutável. O fechamento possui 138 testes
aprovados e 22 migrações. Consulte `docs/SPRINT_15.md`.

A versão `16.0.0` consolida Obras e Medições corporativas. A carteira de obras
reutiliza a hierarquia `Cliente > Site > Prédio > Sala`, contratos e orçamentos;
cronograma físico-financeiro, diário, evidências e boletins possuem fluxo,
retenções, glosas, aceite, auditoria e RLS. Consulte `docs/SPRINT_16.md`.

A versão `17.0.0` conclui Manutenção e Facilities. Chamados corretivos e
preventivos usam SLA por prioridade, ativos e espaços patrimoniais; planos,
ordens, equipes, fornecedores, recursos e custos permanecem rastreáveis. O
fechamento conjunto possui 143 testes aprovados e 25 migrações. Consulte
`docs/SPRINT_17.md`.

A versão `20.0.0` conclui as Sprints 18–20. Convênios, metas, repasses,
execução e prestação de contas passam a operar com regularidade patrimonial,
riscos, auditorias e transparência. O fechamento acrescenta BI executivo,
relatórios configuráveis, portais segregados, integrações e observabilidade,
com RLS e permissões em toda a cadeia. Consulte `docs/SPRINT_18.md`,
`docs/SPRINT_19.md` e `docs/SPRINT_20.md`.

A versão `20.1.0` inicia a estabilização integrada: o roadmap completo passa a
ser acompanhado em `Administração > Auditoria`, os rótulos de Sprint deixam as
telas operacionais e as dependências vulneráveis identificadas na homologação
são atualizadas. Consulte `docs/SPRINT_20_1.md`.

- plano da sprint: `docs/SPRINT_10.md`;
- fechamento patrimonial: `docs/SPRINT_11.md`;
- demandas e investimentos: `docs/SPRINT_12.md`;
- consolidação administrativa: `docs/SPRINT_12_1.md`;
- suprimentos e contratações: `docs/SPRINT_13.md`;
- contratos e atas: `docs/SPRINT_14.md`;
- financeiro-orçamentário: `docs/SPRINT_15.md`;
- obras e medições corporativas: `docs/SPRINT_16.md`;
- manutenção e facilities: `docs/SPRINT_17.md`;
- convênios e prestação de contas: `docs/SPRINT_18.md`;
- regularidade, compliance e transparência: `docs/SPRINT_19.md`;
- BI, portais e consolidação: `docs/SPRINT_20.md`;
- estabilização integrada: `docs/SPRINT_20_1.md`;
- contexto e homologação multiempresa: `docs/SPRINT_21.md`;
- consolidação e prontidão local: `docs/SPRINT_22.md`;
- piloto controlado e produção: `docs/SPRINT_23.md`;
- ambiente corporativo verificável: `docs/SPRINT_24.md`;
- migração definitiva e piloto assistido: `docs/SPRINT_25.md`;
- runbook do piloto: `docs/operacao/PILOTO_PRODUCAO.md`;
- padrão visual da plataforma: `docs/DESIGN_SYSTEM_PRUMO.md`;
- backlog permanente: `BACKLOG_PRUMO.md`;
- configuração da futura API: `VITE_PRUMO_API_URL`;
- configuração do futuro provedor de identidade: `VITE_PRUMO_AUTH_URL`.

## Execução

Requisitos já utilizados na validação:

- Node.js 20 ou superior;
- pnpm 11 ou superior.

```bash
pnpm install
pnpm dev
```

API local temporária, sem dados persistentes:

```bash
PRUMO_API_STORAGE=memory PRUMO_DEV_IDENTITY=true pnpm api
```

No PowerShell:

```powershell
$env:PRUMO_API_STORAGE="memory"
$env:PRUMO_DEV_IDENTITY="true"
pnpm api
```

A API utiliza `http://127.0.0.1:8787` por padrão. A rota `/health` não exige
autenticação; as rotas `/v1` exigem identidade, empresa ativa e, quando
aplicável, equipe.

Para PostgreSQL, copie somente as variáveis necessárias do `.env.example`.
Use `PRUMO_DATABASE_URL` para a conta limitada da API e
`PRUMO_MIGRATION_DATABASE_URL` para a conta proprietária das migrações:

```bash
pnpm db:migrate
pnpm api
```

Validação de produção:

```bash
pnpm production:check
pnpm build
```

O npm também pode ser utilizado, mas o projeto fixa o pnpm 11.9.0 para
manter instalações reproduzíveis entre os ambientes.

## Observação

O frontend ainda oferece persistência local e IndexedDB para dados históricos
do orçamento, composições próprias, preferências e bases de preços. A API e o
PostgreSQL estão ativos no desenvolvimento local, mas esses domínios só podem
abandonar o navegador após inventário, migração assistida e homologação. OIDC e
armazenamento corporativo dos arquivos binários do GED seguem obrigatórios para
produção. Na versão `22.0.0`, o inventário local foi enviado, validado e
homologado no PostgreSQL; os repositórios permanecem em modo híbrido para a
validação reversível antes da ativação corporativa definitiva. A versão
`23.0.0` acrescenta upload e download real do GED por URLs temporárias,
readiness da API e um verificador que impede promover um ambiente sem
PostgreSQL, OIDC, storage e origens HTTPS.

A versão `25.0.0` fecha as Sprints 24 e 25 com prontidão e piloto governados por
organização. Evidências de infraestrutura, migração e homologação são
registradas na Administração; o piloto não inicia sem o ambiente comprovado e
a promoção permanece bloqueada até a aprovação integral do checklist.
