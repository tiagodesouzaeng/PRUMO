# Checkpoint PRUMO v31.0.0

## Estado local

- Sprint 31 implementada localmente;
- migrações `039` a `042` aplicadas no PostgreSQL;
- sistemas PPCI editáveis, removíveis e vinculáveis ao GED;
- Utilidades com medidores e leituras persistidos;
- responsáveis obtidos do cliente ativo;
- correções de Patrimônio, Solicitações e Carteiras incluídas;
- nenhuma publicação, commit, push ou deploy realizado neste checkpoint.

## Validação

- `pnpm test`: **195 testes aprovados, 0 falhas**;
- testes direcionados das Sprints 30 e 31: **11 aprovados, 0 falhas**;
- `pnpm build`: concluído com sucesso;
- API `v31.0.0` e PostgreSQL saudáveis em `http://127.0.0.1:8787/health`;
- frontend disponível em `http://127.0.0.1:5173/`;
- homologação visual concluída para edição de sistemas PPCI, responsáveis,
  vínculo com GED, datas e operação de medidores de Utilidades.

## Próxima evolução sugerida

Sprint 32: correções operacionais do PPCI; leitura direta ou acumulada com
coleta simplificada; metas, tarifas, faturas e alertas de Utilidades; endereço
herdado do Site; e planos preventivos dos ativos integrados à Manutenção.
Escopo completo em `docs/SPRINT_32.md`.
