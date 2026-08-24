# Checkpoint PRUMO v23.0.0

## Estado

- Sprint 23 implementada;
- OIDC e PostgreSQL obrigatórios na configuração de produção;
- storage GED S3 compatível com URLs temporárias e segregação por organização;
- upload, hash SHA-256, versionamento e download integrados na interface;
- endpoints de vivacidade, prontidão pública e prontidão administrativa;
- cabeçalhos de segurança na API e no frontend Netlify;
- verificador de promoção e runbook do piloto incluídos;
- roadmap administrativo atualizado;
- 165 testes automatizados aprovados, sem falhas;
- nenhuma credencial incluída no código ou na documentação.

## Ativação externa

O frontend pode ser publicado independentemente. O piloto corporativo funcional
depende de URLs e credenciais fornecidas pelos serviços externos de API,
PostgreSQL, OIDC e storage. A ativação deve seguir o runbook em
docs/operacao/PILOTO_PRODUCAO.md.
