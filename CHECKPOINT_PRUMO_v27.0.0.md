# Checkpoint PRUMO v27.0.0

## Estado

- Sprint 27 implementada localmente;
- orçamento publicado separado da base contratada;
- desconto vencedor aplicado linearmente por item, sem arredondamento indevido;
- obra obrigatoriamente ligada a orçamento e contrato;
- medições limitadas ao saldo da base homologada;
- solicitações de aditivo submetidas à engenharia de custos;
- migrações `031` e `032` aplicadas com checksums válidos;
- versão pública não alterada e nenhuma ação de Git ou deploy executada.

## Validação

- `178` testes aprovados e nenhuma falha;
- build de produção concluído;
- migrações reaplicadas sem divergência de checksum;
- PostgreSQL validado pelos testes reais de RLS e integração;
- API local saudável na versão `27.0.0`;
- readiness aprovado;
- frontend local respondendo normalmente;
- tela de acesso verificada no navegador; o fluxo autenticado permanece para a
  validação manual do responsável, sem exposição da credencial de contingência.
