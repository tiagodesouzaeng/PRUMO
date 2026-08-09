# Checkpoint PRUMO v10.6.0

Data local: 09/08/2026.

## Estado validado

- versão local `10.6.0`;
- branch de trabalho `codex/prumo-v10.3.0`;
- nenhuma publicação, commit, push, PR ou deploy realizado;
- API local em `127.0.0.1:8787`, PostgreSQL e frontend em `127.0.0.1:5173`;
- migrações 008, 009 e 010 aplicadas com checksum;
- 99 testes aprovados, inclusive os 2 testes reais de PostgreSQL;
- build Vite concluído; aviso não bloqueante de tamanho dos bundles permanece;
- inspeção visual sem erros de console.

## Sprint 10.5

- GED com metadados, versões imutáveis, SHA-256, responsável e histórico;
- armazenamento binário representado por chave segura, fora do banco;
- vínculos de documento preparados para entidades dos módulos;
- integrações com referência de credencial protegida e execuções auditadas.

## Sprint 10.6

- catálogo versionado, capacidades e dependências;
- estados disponível, contratado e habilitado por empresa;
- permissão de usuário mantida como controle independente;
- perfis público, federação, privado, escritório e facilities;
- bloqueio aplicado ao contexto da API e à navegação do frontend;
- alterações de perfil e módulo auditadas.

## Correção de navegação

- menu lateral limitado à altura útil dinâmica da janela;
- módulos rolam dentro do menu, mantendo o recolhimento acessível;
- Administração alcançada em viewport de 1366 × 650 após rolagem interna;
- recolhimento funcional: largura reduzida de 220 px para 78 px, somente ícones;
- preferência preservada localmente sem afetar dados corporativos.

## Riscos e continuidade

- orçamentos, composições próprias, integrações legadas, preferências e dados de
  painéis ainda possuem partes em `localStorage`;
- bases de preços continuam com acervo no IndexedDB até migração assistida;
- OIDC e armazenamento de arquivos binários do GED são pendências de produção;
- backup completo pós-migrações gerado, verificado e restaurado no banco
  descartável `prumo_restauracao_teste`;
- SHA-256 do backup: `4031a5b79f225fa1820528467c3429debe2162e64e9a6eb5949448208c2f7069`;
- restauração confirmou 10 migrações e as tabelas de documentos, integrações e
  produto modular;
- próxima etapa: Sprint 11, cadastro patrimonial canônico
  `Cliente > Site > Prédio > Sala`.
