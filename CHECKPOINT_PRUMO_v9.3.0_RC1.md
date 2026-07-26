# Checkpoint — PRUMO v9.3.0 RC1

Data: 26/07/2026

## Entregas

- numeração automática dos serviços por grupo da EAP;
- inclusão posicionada dentro do grupo selecionado;
- criação de grupo durante o cadastro do serviço;
- importação SINAPI em ZIP, XLSX e XLS;
- versionamento por UF, mês e regime;
- armazenamento IndexedDB;
- hash SHA-256;
- contagem de insumos, composições e referências sem preço;
- seleção de base ativa;
- busca de composições no cadastro do serviço;
- preenchimento de descrição, unidade, fonte e preço;
- atualização controlada dos preços vinculados;
- proteção contra preços zerados.

## Validações

- sequência automática da EAP;
- criação rápida de grupo;
- leitura de planilha;
- leitura de ZIP;
- normalização de unidades;
- classificação de insumos e composições;
- hash da publicação;
- persistência, leitura e exclusão no IndexedDB;
- build de produção;
- revisão funcional e visual no navegador.

## Pendência de homologação externa

O importador está preparado para as publicações oficiais, mas deve ser
homologado com um ZIP mensal real da CAIXA para confirmar todas as variações de
nomes de abas e colunas.
