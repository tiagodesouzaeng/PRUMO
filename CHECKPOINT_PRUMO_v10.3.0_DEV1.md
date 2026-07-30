# Checkpoint PRUMO v10.3.0 DEV1

Data: 30/07/2026

## Fundação multiempresa

- empresas, equipes e vínculos definidos;
- troca de contexto permitida somente para vínculo ativo;
- perfil recalculado conforme a empresa selecionada;
- dados classificados como globais, licenciados ou privados;
- propriedade corporativa aplicada aos registros;
- validação de isolamento entre empresa e equipe;
- caminhos de arquivos segregados por empresa.

## API e concorrência

- contexto de empresa e equipe incluído nas chamadas corporativas;
- token mantido somente na sessão em memória;
- recursos corporativos bloqueados sem empresa ativa;
- chave de idempotência nas criações;
- versão conhecida nas alterações e exclusões;
- conflitos concorrentes tratados de forma compreensível.

## Migração assistida

- inventário dos repositórios locais;
- plano ordenado e reversível;
- pacote com contrato versionado, empresa, responsável e contagens;
- hash SHA-256 e chave de idempotência;
- referência PostgreSQL com segurança por linha.

## Avanço do BL-004

- contrato do trabalho assíncrono de atualização de preços;
- simulação antes da aplicação;
- publicações de destino registradas;
- composições próprias marcadas para recálculo recursivo;
- itens manuais preservados;
- nova revisão obrigatória ao aplicar.

## Limites

- a API, o PostgreSQL, a fila e os workers ainda precisam ser provisionados;
- nenhuma migração real foi executada;
- o contrato BL-004 ainda não compara nem aplica preços;
- nenhuma publicação no GitHub ou Netlify integra este checkpoint.
