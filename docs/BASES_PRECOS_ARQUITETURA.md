# Arquitetura das bases de preços — versão 9.4.4

## Publicação SINAPI nacional

Uma importação do pacote oficial cria uma publicação nacional por competência e regime. Cada insumo e composição conserva um mapa de preços para os 27 estados.

- a tela usa o estado escolhido no filtro;
- quando não há preço no estado, utiliza SP e sinaliza o valor com `*`;
- o modal do item apresenta os preços de todos os estados;
- as composições analíticas continuam compartilhadas, pois os códigos e coeficientes são nacionais.

## Arquivo-fonte e auditoria

O arquivo original é preservado no repositório estruturado interno do navegador, junto de nome, tamanho, tipo, hash e data de importação.

Ao arquivar uma base:

- o catálogo fica indisponível na listagem operacional;
- os dados e composições não são apagados;
- o arquivo recebe um nome interno iniciado por `EXCLUIDO_`;
- são registrados data e usuário da operação;
- um administrador pode restaurar a publicação.

## Limite da arquitetura atual

O PRUMO desta versão é uma aplicação web local, sem servidor de autenticação ou banco corporativo. Portanto, o repositório interno é o IndexedDB do navegador e a indisponibilidade vale para aquele ambiente.

Para uso realmente multiusuário, o mesmo contrato deverá ser conectado a um backend compartilhado com:

- diretório de objetos ou arquivos;
- banco de metadados e preços;
- autenticação e autorização por perfil;
- trilha de auditoria imutável;
- backup e política de retenção.
