# Sprint 21 — Contexto e homologação multiempresa

## Resultado

Sprint concluída localmente.

- banner conectado ao PostgreSQL com Cliente, Site, Prédio e Sala;
- seleção hierárquica persistida por empresa e equipe;
- descendentes calculados sem ultrapassar o isolamento RLS;
- contexto aplicado a Patrimônio, Demandas, Obras, Manutenção e Regularidade;
- exclusão patrimonial com confirmação, versão e diagnóstico detalhado de vínculos;
- massa `homologacao-v22` criada para Município Modelo, Federação Regional Modelo e Projetos Integrados Modelo;
- perfis público, federação e escritório com dados fictícios dos principais módulos.

## Operação

```powershell
pnpm.cmd db:seed:homologacao
```

A carga é idempotente por marcador, utiliza organizações técnicas identificáveis e não contém credenciais nem dados pessoais reais.
