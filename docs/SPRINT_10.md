# Sprint 10 — Plataforma corporativa

## Objetivo

Preparar o PRUMO para operar com usuários autenticados, banco de dados
centralizado, auditoria e controle de acesso, mantendo compatibilidade temporária
com os dados locais da versão atual. A fundação deve atender toda a plataforma:
Patrimônio, Planejamento, Obras, Manutenção, Regularidade, Orçamentos, Bases de
Preços, Suprimentos, Contratos, Financeiro, Medições, Convênios, Relatórios,
Administração, GED e módulos futuros.

## Princípio multimódulo

- orçamento é um módulo da plataforma, não seu núcleo exclusivo;
- empresas, equipes, usuários, permissões e auditoria são compartilhados;
- documentos, notificações, pesquisa, integrações e filas são serviços comuns;
- cada domínio mantém suas regras específicas sem duplicar a infraestrutura;
- o isolamento multiempresa deve proteger uniformemente todos os módulos;
- contratos e eventos devem permitir integração progressiva entre os módulos.

Referência permanente: `docs/arquitetura/PLATAFORMA_MULTIMODULO.md`.

## Realinhamento após a v10.3.0

O PRUMO passa a ser formalmente um produto único e modular para governança de
patrimônio, obras, contratos, serviços e investimentos. O setor público,
federações e entidades distribuídas constituem o público prioritário.

`PRUMO ERP` e `PRUMO Governança` são edições comerciais compostas por módulos da
mesma plataforma. Não haverá bifurcação da base de código ou duplicação de
cadastros. A hierarquia física compartilhada será `Cliente > Site > Prédio >
Sala`, independente da EAP dos orçamentos.

O catálogo funcional está em `docs/arquitetura/CATALOGO_MODULOS.md` e a sequência
das próximas entregas em `docs/ROADMAP_MODULAR.md`.

## Incremento 10.1 — Fundação e diagnóstico

- configuração central do modo de operação;
- cliente inicial para a futura API do PRUMO;
- diagnóstico administrativo de API, autenticação, persistência e auditoria;
- inventário das fontes locais que precisarão ser migradas;
- manutenção do funcionamento local enquanto o backend não estiver configurado;
- testes automatizados da configuração e do cliente.

### 10.2 — Autenticação e sessão

- modelo inicial de sessão mantido somente em memória;
- encerramento e renovação estrutural da sessão;
- seis perfis corporativos com permissões por módulo e ação;
- matriz administrativa de permissões;
- tokens e senhas excluídos da persistência local;
- contratos preparados para conexão posterior a um provedor de identidade.

O incremento 10.2 entrega a fundação de controle de acesso. O login real e a
proteção efetiva das rotas dependem do provedor corporativo e da API previstos
nos incrementos seguintes.

### Entrega complementar — BDI diferenciado

- composição analítica independente da taxa normal;
- faixa referencial do Acórdão TCU 2.622/2013-Plenário;
- aplicação condicionada aos requisitos da Súmula TCU 253/2010;
- justificativa, responsável, data e referência normativa por item;
- retorno seguro ao BDI normal quando a elegibilidade estiver incompleta;
- totalizações separadas e taxa efetiva ponderada do orçamento;
- exportação das fórmulas e da memória de auditoria no pacote de licitação.

## Próximos incrementos

### 10.3 — Banco corporativo e migração

#### Incremento DEV1 — concluído

- modelo de empresas, equipes e vínculos de usuários;
- classificação entre dados globais, licenciados e privados;
- empresa e equipe ativas incorporadas à sessão em memória;
- contexto corporativo enviado nas chamadas da futura API;
- token mantido somente em memória;
- operações de criação com chave de idempotência;
- alterações e exclusões com controle de versão e detecção de concorrência;
- inventário dos repositórios locais;
- pacote de migração com SHA-256, empresa de destino, responsável e contagens;
- plano de migração reversível apresentado na Administração;
- referência PostgreSQL com segurança por linha e negação por padrão;
- segregação prevista para arquivos por empresa;
- contrato assíncrono inicial do BL-004.

#### Incremento DEV2 — concluído

- API HTTP executável com rota de saúde;
- versão inicial das rotas corporativas de orçamentos;
- autenticação OIDC/JWT preparada com JWKS remoto;
- identidade local temporária disponível somente fora de produção;
- inicialização de produção bloqueada sem PostgreSQL e OIDC;
- repositório em memória exclusivo para desenvolvimento e testes;
- adaptador PostgreSQL com transação por operação;
- ativação do contexto somente após validação do vínculo;
- migração SQL com empresas, equipes, vínculos e orçamentos;
- segurança por linha forçada para empresa e equipe;
- criação idempotente de orçamentos;
- atualização por versão e rejeição de sobrescritas concorrentes;
- executor de migrações com checksum e bloqueio de alterações retroativas;
- CORS restrito às origens configuradas;
- testes da API e execução real da rota de saúde.

#### Incremento DEV3 — concluído

- catálogo único dos módulos compartilhado pelo frontend e pela API;
- permissões corporativas relacionadas aos módulos;
- módulos visíveis derivados do perfil e da configuração da empresa;
- unidades organizacionais compartilhadas;
- empreendimento comum para Obras e módulos relacionados;
- rotas corporativas de empreendimentos;
- persistência prevista para revisões de orçamento;
- revisões classificadas como original, revisão, aditivo ou supressão;
- impacto de valor e prazo registrado por revisão;
- persistência prevista para medições;
- valores bruto, retenções, multas e líquido;
- integridade entre medição, orçamento e revisão;
- eventos de domínio para integração progressiva entre módulos;
- RLS aplicado a empreendimentos, revisões, medições e eventos;
- validação de permissões no backend;
- contratos adicionais do cliente corporativo;
- catálogo multimódulo apresentado na Administração.

#### Próximos incrementos da 10.3

- [x] instalar ou provisionar uma instância PostgreSQL de desenvolvimento;
- [x] aplicar as migrações e executar testes RLS no banco real;
- [x] persistir bases, publicações e composições — DEV4;
- [x] enviar e homologar os lotes de migração assistida — DEV5;
- [x] criar fila e workers para bases e cálculos extensos — DEV6;
- [x] substituir gradualmente os repositórios locais após homologação — DEV7;
- [x] executar testes de invasão entre empresas e recuperação de falhas —
  encerramento v10.3.0.

#### Incremento DEV4 — concluído

- catálogo corporativo independente dos orçamentos;
- fontes globais, licenciadas e privadas;
- publicações imutáveis por referência e regime;
- preços por UF com precisão de seis casas;
- parcelas de mão de obra, material e equipamento;
- componentes analíticos com coeficientes de doze casas;
- composições próprias isoladas por empresa;
- paginação de itens sem limite fixo de 80 registros;
- consulta rastreável das composições pela API;
- RLS para fontes, publicações, itens, preços e componentes.

#### Incremento DEV5 — concluído

- área temporária de lotes e registros;
- verificação do SHA-256 e da chave de idempotência no servidor;
- validação de empresa, equipe, responsável, domínios e contagens;
- estados recebido, validado, rejeitado e homologado;
- homologação transacional de orçamentos, composições próprias, bases e
  configurações;
- vínculo entre cada registro de origem e seu destino corporativo;
- repetição segura do envio e da homologação;
- painel de envio, validação e homologação na Administração;
- teste completo executado no PostgreSQL 18.4 local.

#### Incremento DEV6 — concluído

- fila durável no PostgreSQL para trabalhos assíncronos;
- estados pendente, processando, concluído, falhou e cancelado;
- prioridade, progresso, tentativas, bloqueio temporário e resultado;
- eventos de execução preservados para diagnóstico;
- worker separado da requisição principal;
- executores iniciais para diagnóstico, importação de catálogo e recálculo de
  orçamento;
- criação idempotente e reprocessamento controlado;
- painel administrativo para acompanhar e testar a fila;
- RLS aplicado à fila e aos eventos.

#### Incremento DEV7 — concluído

- registro corporativo da fonte ativa de cada domínio;
- modos local, híbrido e corporativo;
- homologação inicia automaticamente o domínio no modo híbrido;
- sincronização dos orçamentos em segundo plano durante o modo híbrido;
- PostgreSQL passa a ser fonte principal somente após confirmação
  administrativa;
- retorno do modo corporativo para o híbrido sem apagar o cache local;
- mapeamento entre identificadores locais e corporativos;
- painel administrativo de ativação e reversão;
- RLS aplicado aos estados de transição.

#### Encerramento v10.3.0 — concluído

- tentativa real de leitura de orçamento entre empresas bloqueada;
- tentativa real de gravação em outra empresa rejeitada pelo PostgreSQL;
- isolamento entre equipes da mesma empresa confirmado;
- retomada de trabalho pendente após reinicialização simulada;
- falha do worker registrada com código e mensagem;
- reprocessamento limitado pelo número máximo de tentativas;
- registros técnicos removidos ao final dos testes;
- versão promovida de desenvolvimento para `10.3.0`.

### 10.4 — Auditoria e governança

- eventos com usuário, data, módulo, antes e depois;
- trilha imutável para aprovações, revisões e exclusões;
- consulta e exportação administrativa;
- tratamento seguro de campos sensíveis na auditoria;
- política de retenção, backup e restauração;
- teste documentado de recuperação do PostgreSQL;
- decisões arquiteturais de licenciamento, capacidades, dependências e perfis
  de organização.

#### Incremento DEV1 — implementado e validado localmente

- trilha corporativa imutável, isolada por empresa e encadeada por SHA-256;
- captura de estado anterior e posterior em orçamentos, empreendimentos,
  revisões, medições e políticas de governança;
- remoção de senhas, tokens, segredos e credenciais dos dados auditados;
- filtros administrativos por módulo, ação e usuário;
- exportação CSV da trilha de auditoria;
- política por empresa para retenção, frequência de backup e último teste de
  restauração;
- scripts locais para gerar, verificar e restaurar backups PostgreSQL em banco
  descartável;
- navegação do orçamento ajustada para exibir todos os módulos sem corte;
- colunas separadas de mão de obra e material na planilha orçamentária;
- abertura de composição filha ao clicar na própria linha, preservando o botão
  explícito para acessibilidade;
- 93 testes aprovados, inclusive o isolamento real no PostgreSQL, e build de
  produção concluído.

#### Encerramento v10.4.0 — concluído

- role operacional `prumo_backup` criada sem ampliar `prumo_api` ou
  `prumo_migrator`;
- cópia completa posterior às migrações 005–007 gerada e validada;
- SHA-256 `a930d9a268f29c946d0e7f40e469f9b349a7bc8c94434589658af59623d3d920`;
- restauração integral aprovada no banco descartável
  `prumo_restauracao_teste`;
- resultado registrado na política corporativa e na trilha de auditoria;
- 93 testes aprovados sem falhas;
- versão local promovida para `10.4.0`.

### 10.5 — Documentos e integrações

- fundação para o futuro GED;
- anexos de medições e documentos técnicos;
- metadados, versão, hash, responsável e histórico dos arquivos;
- credenciais seguras para integrações;
- rotinas de sincronização executadas e auditadas no servidor.

#### Encerramento v10.5 — concluído no incremento 10.6.0

- módulo Documentos e GED incluído na navegação e conectado à API corporativa;
- registros, versões imutáveis, SHA-256, responsável, metadados e referência de
  armazenamento persistidos no PostgreSQL com RLS;
- vínculos polimórficos preparados para medições e demais entidades técnicas;
- integrações corporativas persistem somente referência de credencial e nunca
  devolvem seu conteúdo ao frontend;
- execuções de integração são históricas, imutáveis e auditadas no servidor;
- migração `008_documentos_integracoes.sql` aplicada e endurecida pela migração
  `010_endurecimento_ged_modular.sql`.

### 10.6 — Produto modular

- catálogo versionado de módulos e funcionalidades;
- distinção entre módulo disponível, contratado, habilitado e permitido;
- capacidades e dependências por empresa;
- perfis `publico`, `federacao`, `privado`, `escritorio` e `facilities`;
- terminologia e modelos iniciais configuráveis por perfil;
- bloqueio das capacidades no frontend, API, tarefas, relatórios e integrações;
- ativação e suspensão auditáveis sem migração para outro produto;
- fundação para pacotes comerciais e módulos avulsos.

#### Encerramento v10.6.0 — concluído localmente

- catálogo versionado com capacidades e dependências técnicas;
- contratos por empresa distinguem disponibilidade, contratação e habilitação;
- permissões de perfil continuam determinando o quarto controle: permitido;
- perfis `publico`, `federacao`, `privado`, `escritorio` e `facilities`
  disponíveis na Administração;
- módulos suspensos deixam de aparecer no contexto da API e no menu lateral;
- alterações de perfil, pacote e habilitação são registradas na auditoria;
- dependências obrigatórias protegidas na API e no PostgreSQL;
- menu lateral passou a rolar dentro da altura útil e pode ser recolhido para
  78 px, exibindo somente ícones e preservando a preferência local;
- build de produção concluído e 99 testes aprovados, sem falhas ou saltos.

## Continuidade após a Sprint 10

O desenvolvimento seguirá o roadmap modular:

- Sprint 11 — cadastro patrimonial;
- Sprint 12 — demandas e investimentos;
- Sprint 13 — suprimentos e contratações;
- Sprint 14 — contratos;
- Sprint 15 — financeiro-orçamentário;
- Sprint 16 — obras e medições corporativas;
- Sprint 17 — manutenção e facilities;
- Sprint 18 — convênios e prestação de contas;
- Sprint 19 — compliance e transparência;
- Sprint 20 — BI, portais e consolidação.

Os detalhes, dependências e critérios de passagem estão em
`docs/ROADMAP_MODULAR.md`.

## Fora do escopo imediato

Os itens financeiros e funcionais ainda ativos no `BACKLOG_PRUMO.md` não devem
interromper as fundações de auditoria, documentos e modularização. O BL-002 foi
concluído como entrega complementar do incremento 10.2. Nenhum módulo futuro
deve entrar no catálogo executável antes de possuir permissões, API, persistência
e uma experiência mínima segura.
