# Sprint 10 — Plataforma corporativa

## Objetivo

Preparar o PRUMO para operar com usuários autenticados, banco de dados
centralizado, auditoria e controle de acesso, mantendo compatibilidade temporária
com os dados locais da versão atual. A fundação deve atender toda a plataforma:
Obras, Manutenção, PPCI, Orçamentos, Bases de Preços, Suprimentos, Medições,
Relatórios, Administração, GED e módulos futuros.

## Princípio multimódulo

- orçamento é um módulo da plataforma, não seu núcleo exclusivo;
- empresas, equipes, usuários, permissões e auditoria são compartilhados;
- documentos, notificações, pesquisa, integrações e filas são serviços comuns;
- cada domínio mantém suas regras específicas sem duplicar a infraestrutura;
- o isolamento multiempresa deve proteger uniformemente todos os módulos;
- contratos e eventos devem permitir integração progressiva entre os módulos.

Referência permanente: `docs/arquitetura/PLATAFORMA_MULTIMODULO.md`.

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
- política de retenção, backup e restauração.

### 10.5 — Documentos e integrações

- fundação para o futuro GED;
- anexos de medições e documentos técnicos;
- credenciais seguras para integrações;
- rotinas de sincronização executadas no servidor.

## Fora do escopo imediato

Os itens financeiros ainda ativos no `BACKLOG_PRUMO.md` não devem interromper
a implantação da plataforma corporativa. O BL-002 foi concluído como entrega
complementar do incremento 10.2.
