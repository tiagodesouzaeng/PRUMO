# Sprint 12.1 — Consolidação administrativa

## Resultado

Esta etapa corrige a dispersão funcional identificada antes da Sprint 13. A
Administração passa a ser o centro de governança da plataforma, sem simular
cadastros e comandos que ainda não possuem contrato real de API.

Situação local: concluída na versão `12.1.0`, aguardando homologação do usuário.

## Escopo da Administração

A área administrativa mantém sete grupos operacionais:

- visão operacional baseada em dados reais da API;
- módulos, capacidades, dependências e produto contratado;
- perfis e permissões canônicos da plataforma;
- conectores e execuções de integração;
- governança das bases de preços;
- operação técnica, recuperação e saúde da plataforma;
- auditoria, retenção e exportação de eventos.

As operações cotidianas permanecem em seus módulos. Clientes, sites, prédios e
salas são mantidos em Patrimônio; demandas e carteiras em Planejamento; arquivos
em Documentos; composições e publicações em Bases de Preços. Administração
governa esses domínios, mas não duplica suas telas operacionais.

## Correções executadas

- removidas da navegação as abas demonstrativas de empresas/equipes, fontes de
  dados, cadastros mestres e parâmetros;
- removidos botões sem ação, dados fictícios e indicadores estáticos;
- resumo administrativo conectado ao contexto corporativo, catálogo modular,
  integrações, tarefas e política de auditoria da API;
- matriz de acesso substituída pelo catálogo canônico de módulos, capacidades e
  perfis, incluindo Patrimônio, Planejamento e Documentos;
- catálogo modular detalhado com capacidades e dependências;
- ação de integração renomeada para deixar explícito que testa o worker e não
  importa arquivos automaticamente;
- navegação reduzida e responsiva para evitar uma faixa horizontal improdutiva.

## Pendências explícitas

- implementar OIDC e a API administrativa de usuários, equipes e associações;
- criar manutenção real de organizações e equipes antes de reintroduzir suas
  telas na Administração;
- implementar atualização de conectores e adaptadores que baixem/importem dados
  no servidor; hoje a execução valida o worker e registra a tentativa;
- catalogar capacidades dos oito módulos legados que ainda possuem apenas o
  controle modular básico;
- transformar categorias, pesos e fluxos de Planejamento em parâmetros
  versionados quando houver contrato de domínio e auditoria;
- eliminar, em manutenção posterior, componentes estáticos antigos que ficaram
  inacessíveis e foram descartados pelo build.

## Validação

- 122 testes aprovados, sem falhas ou testes ignorados;
- testes específicos garantem as sete abas e a matriz canônica de permissões;
- build Vite aprovado;
- 19 migrações preservadas, sem nova alteração de banco nesta etapa;
- nenhuma publicação, commit, push, PR ou deploy foi executado.

## Continuidade

A Sprint 13 — Suprimentos e Contratações continua sendo a próxima etapa. Ela só
deve começar após a homologação local desta consolidação administrativa.
