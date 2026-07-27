# Checkpoint — PRUMO v9.4.0 RC1

Data: 26/07/2026

## Entrega

- motor monetário com truncamento em duas casas;
- preços unitários com precisão ampliada;
- desconto global em percentual ou valor;
- cálculo automático do percentual equivalente;
- rateio por serviço com compensação dos resíduos de centavos;
- consolidação dos descontos por grupo da EAP;
- BDI aplicado sobre o custo direto líquido;
- histórico de alterações financeiras;
- snapshot da regra e dos totais nas novas revisões;
- interface e exportação compatíveis com o novo modelo.

## Persistência

- versão do armazenamento local elevada para 3;
- orçamentos anteriores são normalizados com desconto nulo e histórico vazio;
- preço unitário continua armazenado sem redução prévia para duas casas;
- configuração e histórico do desconto permanecem no repositório local.

## Validações executadas

- compilação de produção com 151 módulos;
- truncamento de preço unitário com cinco casas;
- desconto percentual;
- desconto informado em valor;
- fechamento exato da soma dos descontos individuais;
- BDI calculado após o desconto;
- aplicação e remoção do desconto na página local;
- conferência visual da planilha e dos totais.

## Estado

RC1 funcional para avaliação local. A publicação no GitHub depende de
autorização específica.
