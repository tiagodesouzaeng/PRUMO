# Checklist de Deploy — SIGIU / Painel PPCI v4.4.0 RC1

## Antes do commit
- [ ] Rodar `npm run dev`.
- [ ] Confirmar carregamento da API.
- [ ] Testar busca textual.
- [ ] Testar filtros por Status, Categoria, Responsável, Unidade e Situação.
- [ ] Testar chips de filtros ativos.
- [ ] Testar estado vazio filtrado.
- [ ] Testar modo Cards / Lista.
- [ ] Testar persistência de Cards / Lista após atualizar a página.
- [ ] Testar ordenação persistente.
- [ ] Testar Salvar visão, Restaurar e Limpar preferências.
- [ ] Testar exportação CSV.
- [ ] Testar link da Planilha.
- [ ] Testar modal e Link Processo.

## Build
- [ ] Rodar `npm run build`.
- [ ] Corrigir eventuais erros de build.
- [ ] Se houver warnings, registrar e avaliar impacto.

## GitHub
```bash
git status
git add .
git commit -m "Sprint 4.4 - preferencias e preparacao de deploy"
git push origin main
```

## Netlify
- [ ] Confirmar início automático do deploy.
- [ ] Abrir URL pública.
- [ ] Validar painel publicado.
