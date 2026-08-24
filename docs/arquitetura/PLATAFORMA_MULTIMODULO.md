# Princípio permanente — Plataforma multimódulo PRUMO

O PRUMO é uma plataforma corporativa para governança de patrimônio, obras,
contratos, serviços e investimentos. O público prioritário é composto por órgãos
e entidades públicas, federações e organizações com operação distribuída.
Orçamento é um dos módulos, não o núcleo exclusivo do sistema.

`PRUMO ERP` e `PRUMO Governança` são edições comerciais formadas pelos mesmos
módulos. Não devem originar produtos, bancos ou bases de código independentes.

## Catálogo modular

O catálogo funcional, as edições comerciais, as dependências e a situação de
cada domínio são mantidos em `docs/arquitetura/CATALOGO_MODULOS.md`.

Os principais grupos são:

- patrimônio, demandas e investimentos;
- obras, orçamentos, bases de preços, medições e fiscalização;
- suprimentos, contratações, contratos e financeiro-orçamentário;
- manutenção, regularidade e utilidades;
- convênios, documentos, transparência e inteligência;
- administração, auditoria e integrações.

## Núcleo compartilhado

Os módulos devem reutilizar uma única fundação:

- empresas, unidades e equipes;
- usuários, vínculos, perfis e permissões;
- licenças, capacidades e dependências entre módulos;
- autenticação e sessão;
- clientes, sites, prédios, salas, empreendimentos e centros de custo;
- arquivos e documentos;
- auditoria;
- comentários, tarefas e notificações;
- pesquisa global;
- integrações;
- filas e trabalhos assíncronos;
- relatórios e painéis;
- políticas de retenção, backup e restauração.

Nenhum módulo deverá criar sua própria implementação paralela desses recursos.

## Hierarquia física canônica

O cadastro patrimonial compartilhado deve respeitar a sequência:

`Cliente > Site > Prédio > Sala`

Ativos e equipamentos podem ser vinculados à sala. A EAP de um orçamento ou a
estrutura analítica de um projeto é independente dessa hierarquia, embora possa
referenciar seus elementos. Níveis analíticos como etapa, disciplina e serviço
não devem ser transformados em unidades patrimoniais.

## Perfis de organização

A mesma plataforma deve atender perfis `publico`, `federacao`, `privado`,
`escritorio` e `facilities`. O perfil seleciona terminologia, modelos e fluxos
iniciais, sem substituir permissões, licenças ou configurações jurídicas.

Regras de contratação pública devem ser configuráveis. Elas não podem ser
aplicadas automaticamente a federações ou empresas privadas apenas por estarem
na mesma plataforma.

## Licenciamento modular

O acesso a uma funcionalidade depende cumulativamente de:

1. módulo ou capacidade habilitado para a empresa;
2. permissão do usuário para a ação;
3. política de isolamento aplicável ao registro.

O bloqueio deve existir no frontend, API, tarefas, relatórios, exportações e
integrações. Ocultar o menu não é suficiente. Ativações e desativações precisam
ser auditáveis e não podem exigir migração para outro produto.

## Isolamento

Toda entidade privada deve declarar:

- empresa proprietária;
- unidade ou equipe quando aplicável;
- usuário responsável;
- módulo de origem;
- permissões necessárias;
- regras de retenção e auditoria.

O isolamento por empresa deve ser aplicado de forma uniforme em todos os
módulos. As políticas não podem proteger apenas os orçamentos.

## Integração entre módulos

As integrações devem ocorrer por contratos explícitos. Exemplos:

- orçamento aprovado alimenta obra, contrato e suprimentos;
- demanda aprovada alimenta planejamento, orçamento e contratação;
- cronograma alimenta compras, medições e planejamento;
- composições alimentam mão de obra, histograma e aquisições;
- obra gera demandas de manutenção e documentos;
- PPCI pode vincular edificações, serviços, documentos e intervenções;
- medições alimentam evolução física, financeira e auditoria;
- contratos alimentam medições, manutenção e financeiro;
- patrimônio atende obras, manutenção, regularidade e utilidades;
- convênios relacionam fontes de recurso, metas, contratos e execução;
- GED atende todos os módulos sem duplicar arquivos.

## Diretriz de desenvolvimento

Antes de criar uma nova tabela, API, permissão ou componente, deve ser
verificado se o recurso:

1. pertence ao núcleo compartilhado;
2. pertence exclusivamente a um módulo;
3. será consumido por outros módulos;
4. respeita empresa, equipe e permissões;
5. precisa publicar um evento para integrações futuras.

Esta diretriz é permanente e deve orientar todas as próximas sprints.

O roadmap de implantação após a v10.3.0 está em
`docs/ROADMAP_MODULAR.md`.

## Implementação concluída até a Sprint 10.3

- catálogo compartilhado em `shared/platform.js`;
- módulos e permissões no PostgreSQL;
- ativação de módulos por empresa;
- permissões padrão e personalizáveis por empresa;
- unidades organizacionais;
- empreendimentos compartilhados;
- revisões de orçamento;
- medições;
- eventos de domínio;
- isolamento RLS por empresa e equipe.
- catálogo corporativo de fontes, publicações, itens, preços e composições;
- área temporária, validação e homologação dos lotes de migração assistida;
- rastreabilidade entre identificadores locais e registros corporativos.
- fila durável compartilhada, eventos de execução e worker assíncrono;
- transição reversível dos domínios entre armazenamento local, híbrido e
  corporativo;
- sincronização gradual de orçamentos homologados sem remoção imediata do cache
  local.
- testes reais de isolamento entre empresas e equipes;
- recuperação de trabalhos pendentes e reprocessamento limitado após falhas.

As tabelas específicas de Manutenção, PPCI, Suprimentos e outros módulos serão
adicionadas em migrações próprias, reutilizando esse núcleo.
