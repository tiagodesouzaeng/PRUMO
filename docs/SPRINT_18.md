# Sprint 18 — Convênios e prestação de contas

## Resultado

A versão `18.0.0` incorporou o domínio corporativo de convênios, repasses e
prestação de contas ao núcleo multiempresa do PRUMO.

## Entregas

- instrumentos com concedente, convenente, programa, objeto, vigência, repasse e contrapartida;
- plano de trabalho por metas, quantidade, valor e período;
- parcelas previstas e recebidas, contrapartidas, rendimentos e devoluções;
- execução física e financeira ligada a metas e referências de evidência;
- prestações parciais e finais, protocolo, análise, aprovação ou rejeição;
- diligências, prazos e pendências;
- resumo de valor conveniado, recebido, executado, saldo e metas;
- API, interface, permissões, idempotência, versão, auditoria e RLS por empresa/equipe.

Fluxo: `Rascunho > Vigente > Em execução > Prestação de contas > Encerrado`.

## Homologação

1. cadastrar um instrumento e uma meta;
2. ativar e iniciar a execução;
3. lançar um repasse e uma execução;
4. cadastrar prestação parcial e diligência;
5. conferir saldos e isolamento entre equipes.
