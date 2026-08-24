# Sprint 14 — Contratos e Atas

## Resultado

A Sprint 14 conclui a gestão contratual entre Suprimentos e a futura execução
financeira. Somente processos aprovados e seus fornecedores vencedores podem
originar contratos. O domínio atende órgãos públicos, federações e empresas com
terminologia e instrumentos equivalentes.

Situação local: concluída na versão `14.0.0`, aguardando homologação do usuário.

## Escopo entregue

- contratos, atas de registro de preços, ordens de serviço, termos e instrumentos equivalentes;
- vigência, assinatura, valor inicial, valor atualizado, executado e saldo;
- gestores, fiscais técnicos, fiscais administrativos e substitutos;
- ativação condicionada à designação de gestor e fiscal;
- garantias por caução, seguro-garantia, fiança, retenção ou dispensa;
- aditivos de prazo, valor, prazo e valor, supressão e reajuste;
- ocorrências operacionais classificadas por severidade;
- sanções vinculáveis às ocorrências;
- execução contratual preparada para medição, recebimento e financeiro;
- suspensão, reativação, conclusão, rescisão, encerramento e cancelamento;
- histórico decisório imutável e auditoria integral.

## Governança

O módulo possui permissões independentes para consultar, editar, gerir,
fiscalizar, sancionar e encerrar. Criações usam idempotência, alterações usam
controle de versão e todos os registros são isolados por empresa e equipe com
RLS forçado no PostgreSQL.

Fluxo principal:

`Rascunho > Vigente > Concluído/Rescindido > Encerrado`

Contratos vigentes também podem ser suspensos e reativados. A execução nunca
pode ultrapassar o saldo e uma supressão nunca pode reduzir o valor abaixo do já
executado.

## Persistência e integrações

A migração `021_contratos_gestao_contratual.sql` cria contratos, responsáveis,
aditivos, garantias, ocorrências, sanções, execuções e decisões. Contratos depende
obrigatoriamente de Suprimentos e expõe referências para Medições, Financeiro e
Documentos sem duplicar cadastros.

## Validação de encerramento

- 21 migrações aplicadas com checksums preservados;
- 134 testes aprovados, sem falhas ou testes ignorados;
- teste PostgreSQL real confirmou RLS, origem vencedora, execução e aditivo;
- build Vite aprovado;
- API `14.0.0`, PostgreSQL e frontend local ativos;
- backup PostgreSQL verificado e restauração testada após a migração;
- nenhuma publicação, commit, push, PR ou deploy executado.

## Roteiro de homologação

1. abrir `Contratos` no menu lateral;
2. criar um instrumento a partir de processo aprovado e fornecedor vencedor;
3. editar os dados enquanto estiver em rascunho;
4. designar ao menos um gestor e um fiscal;
5. ativar o contrato;
6. registrar execução, garantia, ocorrência e aditivo;
7. verificar valor atualizado, executado e saldo;
8. concluir e encerrar o instrumento, conferindo a trilha decisória.

## Continuidade

A próxima etapa é a Sprint 15 — Financeiro-orçamentário. Ela consumirá pedidos,
contratos, execuções e medições para controlar fontes, compromissos, retenções,
liquidações equivalentes e pagamentos conforme o perfil da organização.
