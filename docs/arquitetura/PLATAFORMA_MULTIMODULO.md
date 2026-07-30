# Princípio permanente — Plataforma multimódulo PRUMO

O PRUMO é uma plataforma corporativa de engenharia e arquitetura. Orçamento é
um dos módulos, não o núcleo exclusivo do sistema.

## Módulos previstos

- visão geral e indicadores;
- obras e contratos;
- orçamentos e composições;
- bases de preços;
- suprimentos e aquisições;
- manutenção;
- PPCI;
- consumo hídrico e utilidades;
- medições e fiscalização;
- relatórios;
- administração;
- documentos e GED;
- outros módulos futuros.

## Núcleo compartilhado

Os módulos devem reutilizar uma única fundação:

- empresas, unidades e equipes;
- usuários, vínculos, perfis e permissões;
- autenticação e sessão;
- obras, empreendimentos e centros de custo;
- arquivos e documentos;
- auditoria;
- comentários, tarefas e notificações;
- pesquisa global;
- integrações;
- filas e trabalhos assíncronos;
- relatórios e painéis;
- políticas de retenção, backup e restauração.

Nenhum módulo deverá criar sua própria implementação paralela desses recursos.

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
- cronograma alimenta compras, medições e planejamento;
- composições alimentam mão de obra, histograma e aquisições;
- obra gera demandas de manutenção e documentos;
- PPCI pode vincular edificações, serviços, documentos e intervenções;
- medições alimentam evolução física, financeira e auditoria;
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
