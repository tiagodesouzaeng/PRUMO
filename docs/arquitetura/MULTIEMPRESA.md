# Arquitetura multiempresa do PRUMO

## Objetivo

Garantir que usuários visualizem e alterem somente os dados das empresas e
equipes às quais pertencem, mantendo bases públicas compartilhadas sem duplicar
grandes volumes. Esta proteção é transversal e deve ser aplicada a todos os
módulos do PRUMO, não somente aos orçamentos.

O núcleo de empresas, equipes, vínculos e permissões é único para Obras,
Manutenção, PPCI, Orçamentos, Suprimentos, Medições, GED e módulos futuros.

## Classificação

- bases públicas homologadas: globais, imutáveis e de somente leitura;
- bases licenciadas: acesso condicionado à empresa e ao contrato;
- orçamentos, revisões e medições: propriedade da empresa, com equipe opcional;
- composições e cotações próprias: privadas da empresa;
- documentos: segregados por empresa e equipe;
- auditoria: privada, imutável e sujeita a permissão específica.

## Barreiras obrigatórias

1. O provedor autentica o usuário.
2. A API consulta os vínculos válidos do usuário.
3. A API valida a seleção da empresa e da equipe.
4. A transação configura internamente o contexto da empresa.
5. O PostgreSQL aplica segurança por linha.
6. O armazenamento usa caminhos segregados.
7. A API emite acesso temporário somente após nova autorização.
8. A auditoria registra empresa, usuário, ação e resultado.

O cabeçalho `X-Prumo-Tenant-Id` informa a seleção da interface, mas nunca é
prova de autorização. O backend deve confrontá-lo com o token e os vínculos
ativos antes de configurar a transação.

## Migração

Os dados locais permanecem operacionais enquanto o backend não estiver
homologado. Cada lote de migração contém:

- versão do contrato;
- empresa e equipe de destino;
- usuário responsável;
- data;
- domínios e contagens;
- hash SHA-256;
- chave de idempotência.

A migração deve usar área temporária, validar referências e contagens e somente
então publicar os dados. A origem local será removida apenas depois da
homologação e da confirmação de recuperação.

## Concorrência

- criações repetidas usam `Idempotency-Key`;
- alterações e exclusões usam a versão conhecida em `If-Match`;
- conflitos retornam `409` ou `412`;
- a interface solicita atualização antes de repetir uma alteração concorrente.

## Processamentos extensos

Importações, migrações, exportações extensas e atualização das bases usadas por
um orçamento serão trabalhos assíncronos. Todos carregam empresa, equipe,
usuário, parâmetros, chave de idempotência e situação do processamento.
