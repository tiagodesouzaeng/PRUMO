# Checkpoint PRUMO v10.3.0 DEV5

Data: 30/07/2026

## Migração assistida

- envio idempotente com SHA-256;
- área temporária por empresa e equipe;
- validação de contrato, responsável, propriedade e contagens;
- homologação transacional;
- rastreabilidade entre origem e destino;
- repetição segura sem duplicação;
- painel administrativo para gerar, validar e homologar lotes.

## PostgreSQL real

- fluxo recebido → validado → homologado executado pela API;
- RLS confirmado com a conta limitada;
- configuração técnica homologada e removida após o teste;
- dados locais preservados até uma homologação explícita do administrador.

## Próxima fundação

- fila e workers para importações extensas e cálculos demorados.

## Publicação

Nenhuma publicação no GitHub ou Netlify integra este checkpoint.
