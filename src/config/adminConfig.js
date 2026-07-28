/* =====================================================
   RELEASE........: v8.0 + v8.1 RC1
   ARQUIVO........: src/config/adminConfig.js
   DESCRIÇÃO......: Configurações administrativas iniciais do SIGIU.
                    Base visual/estrutural para usuários, fontes de dados,
                    sincronização, cadastros mestres e parâmetros globais.
===================================================== */

export const SIGIU_ADMIN_PERFIS = [
  {
    id: "admin-geral",
    nome: "Administrador Geral",
    descricao: "Acesso completo ao PRUMO, configurações, fontes de dados, usuários e módulos.",
    nivel: 100,
  },
  {
    id: "gestor-infraestrutura",
    nome: "Gestor de Infraestrutura",
    descricao: "Gerencia módulos operacionais, alertas, relatórios e acompanhamento das unidades.",
    nivel: 80,
  },
  {
    id: "operador",
    nome: "Operador",
    descricao: "Registra dados operacionais e acompanha os módulos permitidos.",
    nivel: 50,
  },
  {
    id: "consulta",
    nome: "Consulta",
    descricao: "Visualização dos módulos autorizados, sem alteração de configurações.",
    nivel: 20,
  },
];

export const SIGIU_ADMIN_USUARIOS = [
  {
    id: "USR-001",
    nome: "Administrador PRUMO",
    email: "administracao@prumo.local",
    perfil: "Administrador Geral",
    unidade: "Todas",
    modulos: ["PPCI", "Consumo Hídrico", "Obras", "Orçamentos", "Manutenção", "Administração"],
    status: "Ativo",
    ultimoAcesso: "Aguardando autenticação real",
  },
  {
    id: "USR-002",
    nome: "Gestão de Infraestrutura",
    email: "infraestrutura@prumo.local",
    perfil: "Gestor de Infraestrutura",
    unidade: "Campus Canoas",
    modulos: ["PPCI", "Consumo Hídrico", "Obras", "Orçamentos", "Relatórios"],
    status: "Ativo",
    ultimoAcesso: "Perfil estrutural",
  },
  {
    id: "USR-003",
    nome: "Operação Predial",
    email: "operacao.predial@prumo.local",
    perfil: "Operador",
    unidade: "Campus Canoas",
    modulos: ["Consumo Hídrico", "Manutenção"],
    status: "Planejado",
    ultimoAcesso: "Pendente cadastro real",
  },
];

export const SIGIU_ADMIN_FONTES_DADOS = [
  {
    id: "ppci",
    modulo: "PPCI",
    tipo: "Google Apps Script",
    url: "https://script.google.com/macros/s/AKfycbz0bKVJ6Fc8UL7hFv9gAzdDlKyLHIE9Vskwuwydd3uJ9DSdoFt82OZ69ZB_sOwRZn2PlA/exec",
    planilha: "Painel PPCI",
    status: "Ativo",
    sincronizacao: "Consulta direta atual",
    cache: "Previsto",
    ultimaValidacao: "Base operacional existente",
  },
  {
    id: "hidrico",
    modulo: "Consumo Hídrico",
    tipo: "Google Forms + Apps Script",
    url: "A configurar na Sprint 9",
    planilha: "Base_Hidrico_SIGIU",
    status: "Previsto",
    sincronizacao: "Incremental por nova leitura",
    cache: "Recomendado",
    ultimaValidacao: "Aguardando API hídrica",
  },
  {
    id: "obras",
    modulo: "Obras",
    tipo: "Google Sheets / API futura",
    url: "A configurar",
    planilha: "Base_Obras_SIGIU",
    status: "Previsto",
    sincronizacao: "Incremental por atualização",
    cache: "Recomendado",
    ultimaValidacao: "Aguardando módulo",
  },
  {
    id: "manutencao",
    modulo: "Manutenção",
    tipo: "API futura",
    url: "A configurar",
    planilha: "Base_Manutencao_SIGIU",
    status: "Previsto",
    sincronizacao: "A definir",
    cache: "Recomendado",
    ultimaValidacao: "Aguardando módulo",
  },
  {
    id: "orcamento",
    modulo: "Orçamentos",
    tipo: "SINAPI CAIXA + Base corporativa",
    url: "Importação por arquivo oficial versionado",
    planilha: "Base SINAPI RS 06/2026",
    status: "Em implantação",
    sincronizacao: "Publicação mensal controlada",
    cache: "Versões imutáveis",
    ultimaValidacao: "Estrutura SINAPI analisada",
  },
];

export const SIGIU_ADMIN_CADASTROS_MESTRES = [
  {
    grupo: "Unidades",
    total: 6,
    itens: ["Campus Canoas", "Campus Gravataí", "Cachoeira do Sul", "Santa Maria", "Santarém", "Porto Alegre"],
  },
  {
    grupo: "Edificações / Locais",
    total: 12,
    itens: ["Bloco A", "Bloco B", "Bloco C", "Ginásio", "Aparte Hotel", "HU"],
  },
  {
    grupo: "Responsáveis",
    total: 5,
    itens: ["Infraestrutura", "Facilities", "Manutenção Predial", "Equipe Hidráulica", "Suprimentos"],
  },
  {
    grupo: "Pontos de medição",
    total: 0,
    itens: ["A iniciar na Sprint 9", "Poços", "Hidrômetros", "Corsan", "Pontos internos"],
  },
];

export const SIGIU_ADMIN_PARAMETROS_ALERTA = [
  {
    modulo: "PPCI",
    parametros: [
      { nome: "Alerta crítico", valor: "PPCI vencido ou até 30 dias" },
      { nome: "Alerta de atenção", valor: "31 a 90 dias" },
      { nome: "Risco operacional", valor: "Score por prazo, responsável, conclusão e prioridade" },
    ],
  },
  {
    modulo: "Consumo Hídrico",
    parametros: [
      { nome: "Variação de atenção", valor: "+20% sobre média histórica" },
      { nome: "Variação crítica", valor: "+50% sobre média histórica" },
      { nome: "Leitura ausente", valor: "Acima de 2 dias sem leitura" },
    ],
  },
  {
    modulo: "Obras",
    parametros: [
      { nome: "Conclusão próxima", valor: "Até 15 dias" },
      { nome: "Atraso", valor: "Data prevista vencida" },
      { nome: "Sem atualização", valor: "Acima de 7 dias" },
    ],
  },
];

export const SIGIU_ADMIN_SYNC_STATUS = [
  {
    modulo: "PPCI",
    modo: "Completo",
    ultimaSincronizacao: "Consulta em tempo real",
    incremental: "Previsto por updatedAt/hash",
    status: "Operacional",
  },
  {
    modulo: "Consumo Hídrico",
    modo: "Incremental",
    ultimaSincronizacao: "Aguardando implantação",
    incremental: "Por nova linha do Forms",
    status: "Planejado",
  },
  {
    modulo: "Obras",
    modo: "Incremental",
    ultimaSincronizacao: "Aguardando implantação",
    incremental: "Por ID + hash do registro",
    status: "Planejado",
  },
];

export const SIGIU_ADMIN_AUDITORIA = [
  {
    data: "Sprint 8.0",
    usuario: "Sistema",
    acao: "Criado módulo Administração",
    detalhe: "Base visual para governança, usuários e configurações.",
  },
  {
    data: "Sprint 8.1",
    usuario: "Sistema",
    acao: "Criada estrutura de Fontes de Dados",
    detalhe: "URLs, status, sincronização, cache e validação por módulo.",
  },
  {
    data: "Futuro",
    usuario: "Backend PRUMO",
    acao: "Registrar alterações reais",
    detalhe: "Usuário, data, módulo, antes/depois e IP/sessão quando houver autenticação.",
  },
];

export const SIGIU_ADMIN_CONFIG_GERAL = {
  versaoBase: "PRUMO v9.6.0 RC1",
  ambiente: "Desenvolvimento",
  autenticacao: "Estrutural / pendente backend",
  cacheNavegador: "Previsto",
  sincronizacaoIncremental: "Prevista",
  moduloPadrao: "Visão Geral",
};
