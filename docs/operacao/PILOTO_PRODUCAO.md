# Runbook do piloto controlado

## 1. Preparar o ambiente

1. Criar um ambiente separado de homologação/piloto.
2. Disponibilizar PostgreSQL com backup automático e teste de restauração.
3. Configurar provedor OIDC com issuer, audience e JWKS HTTPS.
4. Criar bucket S3 compatível privado, versionado e com criptografia.
5. Publicar a API em HTTPS e restringir CORS à URL do frontend.
6. Definir no frontend somente as URLs públicas da API e autenticação.
7. Executar pnpm production:check; nenhuma pendência pode permanecer.
8. Abrir `Administração > Operação técnica` e registrar uma evidência para cada
   requisito da Sprint 24; o piloto não poderá iniciar antes dessa aprovação.

As credenciais do banco e do storage ficam no cofre de segredos da plataforma de
backend. Não devem ser definidas no Netlify, no frontend ou no repositório.

## 2. Validar antes do piloto

- aplicar todas as migrações e conferir checksums;
- restaurar o backup mais recente em um banco descartável;
- confirmar /health e /ready com resposta 200;
- validar login, expiração da sessão e bloqueio de usuário;
- testar isolamento entre as três organizações de homologação;
- enviar, baixar e conferir o hash de um documento por organização;
- validar fila, integrações, auditoria e exportações;
- revisar os domínios ainda em modo híbrido antes de ativá-los como corporativos.
- registrar na seção de prontidão os resultados de RLS, inventário, lotes,
  fluxos críticos e teste de retorno da Sprint 25.

## 3. Executar o piloto

- público inicial: administradores, gestor, fiscal, operador e consulta;
- duração sugerida: duas semanas ou um ciclo operacional completo;
- registrar incidentes com horário, organização, módulo e X-Request-Id;
- realizar conferência diária de alertas, fila, integrações e backups;
- manter os dados locais preservados enquanto houver domínio em modo híbrido;
- iniciar, suspender, retomar e aprovar o piloto somente pelas decisões
  administrativas auditáveis da seção de Operação técnica;
- treinar primeiro a navegação, contexto Cliente/Site/Prédio/Sala, permissões,
  documentos, auditoria e procedimento de suporte.

## 4. Critérios de promoção

- zero falha crítica aberta;
- nenhum cruzamento de dados entre empresas ou equipes;
- backup e restauração comprovados;
- OIDC, banco, storage e API estáveis durante o período acordado;
- fluxos prioritários aceitos pelos responsáveis de negócio;
- plano de suporte, responsáveis e janela de mudança definidos.

## 5. Retorno seguro

Se um critério crítico falhar, interromper novas gravações, preservar logs e
identificadores de requisição, retornar os repositórios afetados ao modo híbrido
quando aplicável e restaurar somente a partir de um backup verificado. O retorno
não autoriza excluir dados locais ou objetos do bucket.
