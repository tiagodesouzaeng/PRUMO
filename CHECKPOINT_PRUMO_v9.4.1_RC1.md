# Checkpoint PRUMO v9.4.1 RC1

## Escopo concluído

- correção da importação SINAPI oficial em ZIP, XLSX e XLS;
- leitura integral do pacote mensal da CAIXA;
- generalização para múltiplas bases de preços;
- armazenamento das bases fora dos orçamentos;
- vínculo da base e referência em cada item;
- composições próprias com componentes externos;
- atualização dos vínculos após nova publicação.

## Critérios de aceite

- [x] ZIP SINAPI 06/2026 importado com quatro arquivos;
- [x] XLSX de referência importado isoladamente;
- [x] composição 104658 localizada com preço de RS;
- [x] catálogos selecionáveis por item;
- [x] estrutura preparada para PLEO, SBC, ORSE e novas bases;
- [x] componentes analíticos recuperados sob demanda;
- [x] dados preservados localmente em IndexedDB;
- [x] aplicação disponível para avaliação local.

## Próximo passo recomendado

Criar amostras reais de PLEO, SBC e ORSE para consolidar adaptadores específicos
e adicionar uma tela de mapeamento manual de colunas para formatos não
reconhecidos automaticamente.
