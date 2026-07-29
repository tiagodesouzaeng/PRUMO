# Checkpoint PRUMO v9.4.7 RC1

## Homologação de bases e composições

- regra de seleção estadual e fallback para SP centralizada no domínio;
- consolidação de publicações SINAPI estaduais antigas em catálogo nacional;
- detecção explícita de ciclos durante a navegação entre composições;
- validação de código, tipo, coeficiente e preço de cada componente;
- sinalização de composições sem memória analítica;
- destaque das referências incompletas no modal de rastreabilidade;
- preparação da explosão recursiva segura para o futuro relatório de suprimentos.

## Testes automatizados

- preço do estado selecionado;
- fallback de SP com identificação da origem;
- consolidação de referências RS e SP;
- ciclo entre composição ancestral e composição auxiliar;
- componentes com código, coeficiente ou preço ausentes;
- composição completa sem ciclos.

## Critérios validados

- [x] seis testes automatizados executados com sucesso;
- [x] regra única utilizada por importação, catálogo e composição analítica;
- [x] ciclos não são abertos silenciosamente;
- [x] pendências são exibidas ao usuário;
- [x] compilação de produção concluída.

## Próximas validações

- homologar amostras reais dos 27 estados;
- testar composições com três ou mais níveis auxiliares;
- validar adaptadores com arquivos reais PLEO, SBC e ORSE;
- acrescentar mapeamento manual de colunas para bases não reconhecidas.
