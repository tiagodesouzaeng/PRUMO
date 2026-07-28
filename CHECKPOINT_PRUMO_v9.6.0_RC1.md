# Checkpoint PRUMO v9.6.0 RC1

Data: 28/07/2026

## Identidade visual

- logotipo fornecido pelo usuário incorporado como ativo oficial do sistema;
- versão completa aplicada ao menu lateral;
- símbolo aplicado ao cabeçalho móvel;
- identificação textual das principais áreas atualizada para PRUMO.

## Integrações assistidas de bases de preços

- nova aba `Integrações` no módulo Administração;
- fontes iniciais: SINAPI, PLEO, SBC e ORSE;
- endereço direto de arquivo configurável por fonte;
- formatos aceitos: ZIP, XLSX, XLS e CSV;
- validação de HTTPS, extensão, resposta HTTP, conteúdo vazio e limite de 600 MB;
- definição de referência, estado, regime e periodicidade;
- download remoto integrado ao importador homologado;
- hash, catálogo, composições e arquivo-fonte persistidos pelo fluxo existente;
- auditoria local das execuções com sucesso ou falha.

## Limite conhecido

A publicação oficial do SINAPI continua disponível mensalmente em arquivos ZIP
e XLSX. Como não foi identificada API pública estável para descoberta e download
automatizado, a v9.6.0 utiliza a URL direta da publicação. A execução agendada
em segundo plano permanece dependente de backend.

## Validação

- 14 testes automatizados aprovados;
- compilação de produção concluída;
- logotipo conferido na interface móvel;
- central de integrações conferida no módulo Administração;
- nenhuma chamada remota executada durante a homologação visual.
