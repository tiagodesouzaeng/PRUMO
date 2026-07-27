# Checkpoint PRUMO v9.4.2 RC1

## Adequações concluídas

- movimentação da EAP com reordenação e renumeração dos irmãos;
- edição de vínculo com retirada do local anterior e inserção no novo pai;
- hierarquia Site → Prédio → Andar → Sala → Disciplina → Serviço;
- migração dos grupos históricos para Disciplina sem perda de dados;
- Bases de Preços transformada em submódulo independente;
- catálogos selecionáveis por fonte, mês e estado;
- composições SINAPI visíveis separadamente dos insumos;
- leitura analítica das composições no orçamento;
- modal de composição própria com busca de componentes externos;
- Base própria PRUMO persistida fora dos orçamentos.

## Validações

- [x] compilação de produção;
- [x] reclassificação de dois serviços após mover e restauração da ordem;
- [x] reposicionamento entre grupos validado no domínio;
- [x] cinco níveis exibidos no cadastro da EAP;
- [x] catálogo SINAPI exibindo 10.454 composições;
- [x] composição 103689 aberta com sete componentes analíticos;
- [x] preços e origem RS/06-2026 exibidos por componente;
- [x] modal de composição própria disponível no submódulo;
- [x] persistência independente mantida em IndexedDB e armazenamento local.

## Referência funcional estudada

Foram considerados os padrões divulgados oficialmente pela OrçaFascio:

- separação entre Orçamento de Obras, Bases de Composições e Gestão de Bases
  Próprias;
- rastreabilidade de composições e memória de cálculo;
- bases oficiais e bases próprias centralizadas;
- composições analíticas com insumos, produtividade e origem.

As referências foram usadas como orientação funcional, sem reprodução de
interface, código ou ativos proprietários.
