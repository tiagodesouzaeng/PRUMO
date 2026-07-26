# Checkpoint — PRUMO v9.0.0 RC1

Data: 26/07/2026

## Estado

O módulo de Orçamentos está integrado à base histórica do SIGIU e disponível como funcionalidade nativa do PRUMO.

## Integrações concluídas

- rota principal `orcamento`;
- navegação lateral;
- navegação móvel;
- visão geral;
- administração e fontes de dados;
- estilos responsivos;
- projeto executável com Vite;
- build de produção validado.

## Próxima evolução recomendada

1. Definir o modelo persistente de orçamento, itens, composições, medições e revisões.
2. Conectar a fonte SINAPI oficial e o histórico imutável de versões.
3. Implementar permissões por perfil e trilha de auditoria.
4. Integrar obras, contratos, compras e financeiro aos itens orçamentários.
5. Criar testes automatizados para cálculos, BDI, medições e revisões.
