# Backlog permanente do PRUMO

Atualizado em: 30/07/2026

Este arquivo é o registro permanente das melhorias que não devem interromper a
sprint em execução. Novos itens devem receber um identificador, contexto,
critérios mínimos de aceite e manter o histórico de situação.

## Situações

- `A avaliar`: demanda registrada, ainda sem desenho funcional definitivo.
- `Pesquisado`: referências e premissas levantadas, aguardando planejamento.
- `Planejado`: incluído formalmente em uma sprint futura.
- `Em desenvolvimento`: implementação iniciada.
- `Concluído`: implementado e validado.

## Itens ativos

### BL-001 — Separação do custo unitário entre material e mão de obra

- **Situação:** A avaliar
- **Prioridade sugerida:** Alta
- **Módulos afetados:** Bases de Preços, Composições, Orçamentos, Propostas e
  Licitações
- **Necessidade:** o custo unitário de cada composição e item do orçamento deve
  ser formado e exibido como `Material + Mão de obra (serviços)`.
- **Motivação:** permitir a aplicação correta e auditável dos encargos sociais
  sobre a parcela pertinente da proposta.
- **Critérios mínimos para futura implementação:**
  - classificar recursivamente os componentes das composições;
  - separar mão de obra, materiais e, se necessário, equipamentos;
  - preservar a rastreabilidade até o insumo de origem;
  - garantir que a soma das parcelas corresponda ao custo unitário;
  - definir explicitamente a base de incidência dos encargos sociais;
  - refletir a separação nas telas e planilhas de licitação.

### BL-002 — BDI diferenciado para fornecimentos relevantes

- **Situação:** Concluído na v10.2.0 DEV1
- **Prioridade sugerida:** Alta
- **Módulos afetados:** BDI e Encargos, Orçamentos, Propostas e Licitações
- **Necessidade:** permitir BDI reduzido para itens de mero fornecimento quando
  estiverem presentes os requisitos técnicos e jurídicos aplicáveis.
- **Premissas levantadas:**
  - a Súmula TCU 253 condiciona o BDI reduzido à inviabilidade
    técnico-econômica de parcelamento, à natureza específica do fornecimento, à
    possibilidade de fornecimento por empresa especializada e à
    representatividade do item no valor global;
  - materiais ordinários incorporados à execução da obra não devem ser
    automaticamente tratados como fornecimento sujeito a BDI diferenciado;
  - o Acórdão TCU 2.622/2013-Plenário apresenta faixa referencial de 11,10% a
    16,80%, com média de 14,02%, para mero fornecimento de materiais e
    equipamentos;
  - o BDI diferenciado tende a excluir o ISS do mero fornecimento e a reduzir
    parcelas como administração central e remuneração, mas a taxa deve ser
    calculada e justificada para o caso concreto;
  - situações de aquisição, fabricação ou logística não padronizadas podem
    exigir cálculo específico conforme a complexidade.
- **Critérios implementados:**
  - classificação explícita do item como serviço, material ordinário ou mero
    fornecimento relevante;
  - justificativa técnica obrigatória e registro da inviabilidade de
    parcelamento;
  - duas composições de BDI independentes, normal e diferenciada;
  - memória de cálculo, autor, data e referência normativa;
  - aplicação do BDI selecionado no item, com totalizações auditáveis;
  - alertas para uso indevido do BDI reduzido.
- **Resultado entregue:**
  - composição analítica independente para o BDI normal e o diferenciado;
  - validação obrigatória dos requisitos da Súmula TCU 253/2010 antes da
    aplicação da taxa reduzida;
  - retorno automático ao BDI normal enquanto houver requisito, responsável ou
    justificativa pendente;
  - memória normativa e técnica por item, com responsável e data;
  - bases, valores e quantidades de itens separados nas totalizações;
  - aplicação da taxa correspondente nas planilhas de orçamento e proposta;
  - memória dos itens classificados na aba `BDI e Encargos` do pacote XLSX.
- **Referências oficiais consultadas:**
  - Súmula TCU 253/2010:
    https://pesquisa.apps.tcu.gov.br/documento/sumula/%2A/NUMERO%253A253%2520/DTRELEVANCIA%20desc%2C%20NUMEROINT%20desc/0/sinonimos%253Dtrue
  - Acórdão TCU 2.622/2013-Plenário:
    https://pesquisa.apps.tcu.gov.br/documento/acordao-completo/%2A/NUMACORDAO%3A2622%20ANOACORDAO%3A2013%20COLEGIADO%3A%22Plen%C3%A1rio%22/DTRELEVANCIA%20desc%2C%20NUMACORDAOINT%20desc/0
  - Manual de Obras e Serviços de Engenharia da Consultoria-Geral da União,
    itens 2.5.8 e 2.9:
    https://www.gov.br/agu/pt-br/composicao/cgu/arquivos/ManualdeObraseservicosdeengenharia.pdf
  - Portaria Conjunta MGI/MF/CGU nº 33/2023, art. 74:
    https://www.gov.br/transferegov/pt-br/legislacao/portarias/portaria-conjunta-mgi-mf-cgu-no-33-de-30-de-agosto-de-2023

### BL-003 — Estratégia de importação de bases públicas e gratuitas

- **Situação:** Em desenvolvimento — catálogo corporativo concluído na v10.3 DEV4
- **Prioridade sugerida:** Alta
- **Módulos afetados:** Bases de Preços, Administração, Composições,
  Orçamentos e Integrações
- **Necessidade:** manter um catálogo de fontes públicas e gratuitas de preços,
  insumos e composições de obras, preparando importadores independentes e
  auditáveis para futuras versões do PRUMO.

#### Fontes prioritárias confirmadas

| Base | Gestor | Cobertura | Publicação identificada | Prioridade |
|---|---|---|---|---|
| SINAPI | CAIXA/IBGE | Edificações e serviços de engenharia, todas as UF | Mensal, ZIP com XLSX de insumos, composições, famílias, manutenção e percentual de mão de obra | P0 — importador existente a consolidar |
| SICRO | DNIT | Infraestrutura rodoviária, ferroviária, aquaviária e correlata, por UF | Relatórios por estado e referência, normalmente em pacotes 7Z, com ciclos trimestrais observados | P1 |
| ORSE | CEHOP/SE | Obras e serviços de engenharia, referência Sergipe | Base mensal para download e consulta web de composições analíticas | P1 |
| SIURB | Prefeitura de São Paulo | Edificações e infraestrutura urbana | Publicação semestral, em janeiro e julho, com arquivos Excel onerados e desonerados | P1 |
| SEINFRA-CE | Governo do Ceará | Edificações e infraestrutura | Tabelas versionadas com insumos, composições, planos de serviços e mão de obra em XLS, ODS, PDF e ZIP | P2 |
| SCO-RIO | Prefeitura do Rio de Janeiro | Obras e serviços municipais | Catálogos de itens elementares, serviços, composições e boletins; disponibilidade pública, mas formatos e atualização automatizada precisam ser confirmados | P2 — validação técnica |
| Preço SETOP | Governo de Minas Gerais | Obras de edificações estaduais | Planilha referencial com composições; página pública localizada, mas continuidade, versão atual e formato precisam ser confirmados | P2 — validação técnica |
| Tabela de Custos de Curitiba | Prefeitura de Curitiba | Edificações, infraestrutura, iluminação e itens complementares | Arquivos XLSX de composições, cotações, encargos e BDI; periodicidade observada como anual | P2 — complementar |

#### Fontes não enquadradas como gratuitas

- **EMOP-RJ:** é uma referência pública oficial, porém a página oficial informa
  cobrança pelos boletins e catálogos completos. Não deve entrar na fila de
  importadores gratuitos sem mudança de licenciamento ou autorização.
- Bases privadas como SBC, TCPO/PINI e equivalentes devem ser tratadas por
  importação licenciada pelo usuário, sem redistribuição pelo PRUMO.

#### Estratégia técnica prevista

1. **Cadastro da fonte**
   - órgão gestor, endereço oficial, abrangência, regime, periodicidade,
     licença/condições de uso e situação operacional;
   - separação entre a identidade da base e cada publicação mensal, trimestral
     ou semestral.
2. **Aquisição auditável**
   - download somente de endereço oficial HTTPS;
   - preservação do arquivo original, URL, data, tamanho e hash;
   - suporte planejado a ZIP, 7Z, XLSX, XLS, ODS, CSV e, apenas como último
     recurso, PDF estruturado;
   - importação manual como alternativa quando não houver endereço estável.
3. **Adaptadores independentes**
   - um adaptador por fonte e versão de leiaute;
   - detecção por conteúdo e cabeçalhos, nunca apenas pelo nome do arquivo;
   - testes com amostras reais preservadas e sem acoplamento ao orçamento.
4. **Modelo canônico do PRUMO**
   - fonte, publicação, referência, UF/região, regime e código original;
   - tipo: composição, insumo, mão de obra, material, equipamento ou serviço
     auxiliar;
   - descrição, unidade, preço e situação do preço;
   - componentes analíticos, coeficientes e vínculos recursivos;
   - parcelas de material, mão de obra e equipamento quando publicadas ou
     calculáveis;
   - rastreabilidade integral até o registro e arquivo de origem.
5. **Validação antes da publicação**
   - contagem de registros, códigos duplicados, unidades vazias e preços
     ausentes;
   - conferência da soma analítica das composições;
   - detecção de ciclos e referências inexistentes;
   - comparação com a publicação anterior e alerta para variações anormais;
   - prévia para homologação antes de disponibilizar a base aos usuários.
6. **Versionamento**
   - publicações imutáveis e independentes dos orçamentos;
   - arquivamento e restauração administrativa;
   - atualização dos itens do orçamento somente por ação controlada, com
     comparação entre valores anteriores e novos.

#### Ordem recomendada de desenvolvimento

1. consolidar o adaptador nacional do SINAPI e seus testes de regressão;
2. criar o mecanismo comum de adaptadores e implementar SICRO;
3. implementar ORSE e SIURB, que ampliam a cobertura de edificações;
4. implementar SEINFRA-CE;
5. homologar SCO-RIO, SETOP e Curitiba após validar continuidade, formatos e
   condições de uso;
6. disponibilizar um importador genérico mapeável para bases públicas futuras e
   arquivos licenciados fornecidos pelo usuário.

#### Referências oficiais consultadas

- SINAPI — CAIXA:
  https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx
- SICRO — DNIT:
  https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/custos-referenciais/sistemas-de-custos/sicro
- Relatórios SICRO — DNIT:
  https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/custos-referenciais/sistemas-de-custos/sicro/relatorios
- ORSE — CEHOP/SE:
  https://orse.cehop.se.gov.br/
- SEINFRA-CE — downloads da Tabela de Custos:
  https://sites.seinfra.ce.gov.br/siproce/desonerada/tabela-custo-download.html
- SIURB — Tabelas de Custos:
  https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179
- SCO-RIO — consulta pública:
  https://www.rio.rj.gov.br/web/guest/resultado?parambusca=SCO
- Preço SETOP — SEINFRA/MG:
  https://www.infraestrutura.mg.gov.br/ajuda/page/44-preco-setop
- Tabela de Custos — Prefeitura de Curitiba:
  https://obras.curitiba.pr.gov.br/conteudo/tabela-de-custos/825
- Condições comerciais dos catálogos EMOP-RJ:
  https://www.rj.gov.br/emop/catalogos-emop

### BL-004 — Atualização das bases de preços utilizadas pelo orçamento

- **Situação:** Planejado — catálogo corporativo disponível na v10.3 DEV4
- **Prioridade sugerida:** Alta
- **Módulos afetados:** Orçamentos, Revisões, Bases de Preços, Composições
  Próprias, Cronograma, Suprimentos, Propostas e Licitações
- **Necessidade:** permitir que o responsável atualize um orçamento elaborado
  com publicações antigas das bases de preços para publicações mais recentes,
  antes de sua aprovação, contratação ou publicação.
- **Exemplo de aplicação:** um orçamento elaborado com a referência `05/2026`
  poderá ser comparado e atualizado para `06/2026` ou outra publicação
  homologada disponível.
- **Premissas funcionais:**
  - a atualização deve ser iniciada por uma ação explícita do usuário;
  - o usuário deve selecionar a publicação de destino de cada base utilizada;
  - estado, regime, unidade e código original devem participar da
    correspondência;
  - itens sem preço no estado selecionado devem continuar sujeitos à regra
    controlada de substituição por SP, com indicação da origem;
  - composições próprias devem ser recalculadas recursivamente quando
    utilizarem insumos ou composições das bases atualizadas;
  - a atualização não deve alterar a publicação original nem sobrescrever
    silenciosamente o orçamento vigente.
- **Critérios mínimos para futura implementação:**
  - botão ou assistente `Atualizar bases de preços` dentro do orçamento;
  - inventário das bases e publicações utilizadas direta ou indiretamente;
  - sugestão das publicações homologadas mais recentes;
  - simulação anterior à aplicação, exibindo valor anterior, novo valor,
    diferença absoluta e variação percentual;
  - identificação de itens incluídos, removidos, sem correspondência, sem preço
    ou com alteração de unidade e descrição;
  - recálculo recursivo e rastreável das composições próprias;
  - detecção de ciclos e referências quebradas;
  - atualização dos custos de material, mão de obra e equipamento conforme a
    classificação disponível;
  - recálculo dos itens, grupos da EAP, BDI, cronograma, suprimentos e total do
    orçamento;
  - seleção dos itens que poderão ou não ser atualizados;
  - justificativa e confirmação obrigatórias antes da aplicação;
  - criação automática de uma nova revisão do orçamento;
  - preservação da revisão anterior para comparação e restauração;
  - memória contendo usuário, data, publicações de origem e destino e todos os
    valores alterados;
  - bloqueio ou fluxo específico para orçamentos já aprovados, tratando a
    atualização como estudo de aditivo ou supressão;
  - testes de regressão garantindo que itens manuais ou expressamente
    congelados não sejam alterados.
- **Diretriz técnica:** o cálculo deverá operar no servidor como trabalho
  assíncrono quando o orçamento ou as composições relacionadas tiverem grande
  volume, permitindo acompanhar o progresso e cancelar antes da aplicação
  definitiva.
- **Avanço na v10.3.0 DEV1:**
  - criado o contrato do trabalho `atualizar-precos-orcamento`;
  - empresa, equipe, usuário, orçamento e revisão de origem são obrigatórios;
  - publicações de destino fazem parte da chave de idempotência;
  - a primeira execução é obrigatoriamente uma simulação;
  - o contrato prevê recálculo recursivo das composições próprias;
  - itens manuais são preservados por padrão;
  - a aplicação definitiva já exige a criação de uma nova revisão;
  - a comparação e a aplicação efetiva permanecem pendentes do catálogo
    corporativo e dos workers das próximas entregas.
- **Avanço na v10.3.0 DEV4/DEV5:**
  - fontes, publicações, itens, preços por UF e componentes analíticos já possuem
    persistência corporativa;
  - composições próprias podem ser homologadas por lote;
  - cada publicação preserva referência, regime, arquivo e hash de origem;
  - permanece pendente o worker que fará a comparação e o recálculo assíncrono
    do orçamento.
- **Avanço na v10.3.0 DEV6/DEV7:**
  - implantada a fila PostgreSQL com progresso, tentativas e reprocessamento;
  - implantado o worker separado da interação principal;
  - disponível o executor inicial de recálculo de orçamento;
  - os repositórios homologados agora passam por modo híbrido antes da ativação
    corporativa;
  - permanece pendente a regra completa de comparação entre publicações e a
    geração automática da revisão de atualização de preços.

## Histórico

| Data | Item | Alteração |
|---|---|---|
| 30/07/2026 | BL-001 | Registrada a separação de material e mão de obra. |
| 30/07/2026 | BL-002 | Registrado e pesquisado o BDI diferenciado. |
| 30/07/2026 | BL-003 | Pesquisadas bases públicas gratuitas e definida a estratégia inicial de importadores. |
| 30/07/2026 | BL-002 | Implementado o BDI diferenciado com elegibilidade, memória, totalização e exportação auditáveis. |
| 30/07/2026 | BL-004 | Registrada a atualização controlada das bases utilizadas pelo orçamento e pelas composições próprias. |
| 30/07/2026 | BL-004 | Preparado o contrato assíncrono, seguro e idempotente para simulação e futura aplicação. |
| 30/07/2026 | BL-003 | Implantado o catálogo PostgreSQL de fontes, publicações, itens, preços por UF e composições. |
| 30/07/2026 | BL-004 | Disponibilizada a persistência necessária para o futuro worker de atualização. |
| 30/07/2026 | BL-004 | Implantados a fila, o worker inicial e a transição híbrida dos repositórios. |
