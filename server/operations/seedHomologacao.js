import pg from "pg";
import { pathToFileURL } from "node:url";
import { criarRepositorioPostgres } from "../db/postgresRepository.js";

const { Client } = pg;
const VERSAO_MASSA = "homologacao-v22";
const IDENTIDADE = process.env.PRUMO_SEED_SUBJECT || "homologacao@prumo.local";
const IDENTIDADE_CONTINGENCIA = process.env.PRUMO_LOCAL_ADMIN_SUBJECT || "local-admin";

export const EMPRESAS_HOMOLOGACAO = [
  {
    tenantId: "21000000-0000-4000-8000-000000000001",
    teamId: "21100000-0000-4000-8000-000000000001",
    nome: "Município Modelo",
    equipe: "Secretaria de Infraestrutura",
    perfil: "publico",
    cliente: "Prefeitura Municipal Modelo",
    site: "Centro Administrativo Municipal",
    predio: "Paço Municipal",
    sala: "Sala de Engenharia",
    fornecedor: "Construtora Horizonte Modelo Ltda.",
    documento: "00.000.000/0001-01",
    multiplicador: 1,
  },
  {
    tenantId: "22000000-0000-4000-8000-000000000002",
    teamId: "22100000-0000-4000-8000-000000000002",
    nome: "Federação Regional Modelo",
    equipe: "Gerência de Engenharia e Patrimônio",
    perfil: "federacao",
    cliente: "Federação Regional Modelo",
    site: "Complexo Institucional Metropolitano",
    predio: "Edifício Sede",
    sala: "Núcleo de Projetos",
    fornecedor: "Engenharia Sul Modelo S.A.",
    documento: "00.000.000/0002-82",
    multiplicador: 1.4,
  },
  {
    tenantId: "23000000-0000-4000-8000-000000000003",
    teamId: "23100000-0000-4000-8000-000000000003",
    nome: "Projetos Integrados Modelo",
    equipe: "Escritório de Projetos",
    perfil: "escritorio",
    cliente: "Cliente Corporativo Modelo",
    site: "Parque Empresarial Modelo",
    predio: "Torre Administrativa",
    sala: "Coordenação BIM",
    fornecedor: "Instalações Técnicas Modelo Ltda.",
    documento: "00.000.000/0003-63",
    multiplicador: 0.8,
  },
];

async function prepararEmpresa(admin, empresa) {
  await admin.query("BEGIN");
  try {
    await admin.query(
      "INSERT INTO app.tenants(id,nome) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET nome=EXCLUDED.nome,status='ativo'",
      [empresa.tenantId, empresa.nome],
    );
    await admin.query(
      "INSERT INTO app.teams(tenant_id,id,nome) VALUES($1,$2,$3) ON CONFLICT(tenant_id,id) DO UPDATE SET nome=EXCLUDED.nome,status='ativo'",
      [empresa.tenantId, empresa.teamId, empresa.equipe],
    );
    await admin.query(
      "INSERT INTO app.memberships(tenant_id,identity_subject,perfil_id) VALUES($1,$2,'administrador') ON CONFLICT(tenant_id,identity_subject) DO UPDATE SET perfil_id='administrador',status='ativo'",
      [empresa.tenantId, IDENTIDADE],
    );
    await admin.query(
      "INSERT INTO app.team_memberships(tenant_id,team_id,identity_subject) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [empresa.tenantId, empresa.teamId, IDENTIDADE],
    );
    await admin.query(
      "INSERT INTO app.memberships(tenant_id,identity_subject,perfil_id) VALUES($1,$2,'administrador') ON CONFLICT(tenant_id,identity_subject) DO UPDATE SET perfil_id='administrador',status='ativo'",
      [empresa.tenantId, IDENTIDADE_CONTINGENCIA],
    );
    await admin.query(
      "INSERT INTO app.team_memberships(tenant_id,team_id,identity_subject) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [empresa.tenantId, empresa.teamId, IDENTIDADE_CONTINGENCIA],
    );
    await admin.query("SELECT app.ativar_contexto($1,$2,$3)", [empresa.tenantId, IDENTIDADE, empresa.teamId]);
    const existe = await admin.query(
      "SELECT EXISTS(SELECT 1 FROM app.integration_channels WHERE tenant_id=$1 AND configuracao_publica->>'massa'=$2) AS existe",
      [empresa.tenantId, VERSAO_MASSA],
    );
    await admin.query("COMMIT");
    return Boolean(existe.rows[0]?.existe);
  } catch (error) {
    await admin.query("ROLLBACK");
    throw error;
  }
}

async function popularEmpresa(repository, empresa) {
  const contexto = { identity: { subject: IDENTIDADE }, tenantId: empresa.tenantId, teamId: empresa.teamId };
  const dadosMassa = { massa: VERSAO_MASSA, ficticio: true };
  const valor = (base) => Math.trunc(base * empresa.multiplicador * 100) / 100;
  const chave = (item) => `${VERSAO_MASSA}:${empresa.tenantId}:${item}`;

  await repository.atualizarPerfilProduto(contexto, {
    perfil: empresa.perfil,
    terminologia: {},
    templates: { massaHomologacao: VERSAO_MASSA },
  });

  const cliente = await repository.criarUnidadePatrimonial(contexto, {
    nivel: "cliente", codigo: "C-01", nome: empresa.cliente, responsavel: "Gestor Patrimonial", dados: dadosMassa,
  }, chave("cliente"));
  const site = await repository.criarUnidadePatrimonial(contexto, {
    nivel: "site", parentId: cliente.id, codigo: "S-01", nome: empresa.site,
    endereco: { logradouro: "Avenida Institucional, 1000", cidade: "Cidade Modelo", uf: "RS" }, dados: dadosMassa,
  }, chave("site"));
  const predio = await repository.criarUnidadePatrimonial(contexto, {
    nivel: "predio", parentId: site.id, codigo: "P-01", nome: empresa.predio, areaM2: valor(4800), ocupacao: "Administrativo", dados: dadosMassa,
  }, chave("predio"));
  const sala = await repository.criarUnidadePatrimonial(contexto, {
    nivel: "sala", parentId: predio.id, codigo: "SL-01", nome: empresa.sala, areaM2: valor(120), ocupacao: "Engenharia", dados: dadosMassa,
  }, chave("sala"));
  const ativo = await repository.criarAtivoPatrimonial(contexto, {
    salaId: sala.id, codigo: "AT-01", nome: "Unidade de climatização", categoria: "climatizacao",
    numeroPatrimonio: "PAT-2026-001", fabricante: "Fabricante Modelo", modelo: "VRF-48", status: "ativo", dados: dadosMassa,
  }, chave("ativo"));

  const orcamento = await repository.criarOrcamento(contexto, {
    nome: "Requalificação das instalações 2027",
    dados: { ...dadosMassa, codigo: "ORC-2027-01", status: "em_elaboracao", valorTotal: valor(850000) },
  }, chave("orcamento"));

  const carteira = await repository.criarCarteiraInvestimento(contexto, {
    codigo: "CAR-2027", nome: "Carteira anual de investimentos", ano: 2027,
    limiteFinanceiro: valor(2500000), dados: dadosMassa,
  }, chave("carteira"));
  let demanda = await repository.criarDemandaInvestimento(contexto, {
    patrimonioUnidadeId: predio.id, codigo: "D-2027-01", titulo: "Modernização predial e eficiência energética",
    descricao: "Adequações civis, elétricas, climatização e acessibilidade.", valorEstimado: valor(850000), dados: dadosMassa,
  }, chave("demanda"));
  for (const acao of ["enviar_analise", "priorizar", "aprovar"]) {
    demanda = (await repository.decidirDemandaInvestimento(contexto, demanda.id, { acao, justificativa: "Demanda priorizada para homologação funcional." }, demanda.versao, chave(`demanda-${acao}`))).demanda;
  }
  demanda = (await repository.incorporarDemandaCarteira(contexto, carteira.id, {
    demandId: demanda.id, ordem: 1, valorPlanejado: valor(820000),
  }, demanda.versao, chave("incorporar-demanda"))).demanda;

  const fornecedor = await repository.criarFornecedor(contexto, {
    codigo: "F-01", razaoSocial: empresa.fornecedor, documento: empresa.documento,
    email: "contato@fornecedor-modelo.local", telefone: "(51) 3000-0000", qualificacao: "qualificado", dados: dadosMassa,
  }, chave("fornecedor"));
  let processo = await repository.criarProcessoContratacao(contexto, {
    demandId: demanda.id, codigo: "PC-2027-01", titulo: "Contratação da modernização predial",
    objeto: "Execução integrada dos serviços de requalificação", tipo: "servico", regime: empresa.perfil === "escritorio" ? "privado" : "publico",
    valorEstimado: valor(820000), dados: dadosMassa,
  }, chave("processo"));
  for (const acao of ["iniciar_planejamento", "abrir_pesquisa"]) {
    processo = (await repository.decidirProcessoContratacao(contexto, processo.id, { acao, dados: dadosMassa }, processo.versao, chave(`processo-${acao}`))).processo;
  }
  await repository.registrarCotacao(contexto, processo.id, {
    supplierId: fornecedor.id, valorTotal: valor(798000), prazoEntregaDias: 120, dados: dadosMassa,
  }, chave("cotacao"));
  for (const acao of ["iniciar_selecao", "aprovar"]) {
    processo = (await repository.decidirProcessoContratacao(contexto, processo.id, { acao, dados: dadosMassa }, processo.versao, chave(`processo-${acao}`))).processo;
  }

  let contrato = await repository.criarContrato(contexto, {
    processId: processo.id, supplierId: fornecedor.id, codigo: "CT-2027-01", numero: "001/2027",
    titulo: "Contrato de modernização predial", objeto: "Execução dos serviços de requalificação", dataInicio: "2027-01-15",
    dataFim: "2027-10-31", valorInicial: valor(798000), dados: dadosMassa,
  }, chave("contrato"));
  await repository.adicionarResponsavelContrato(contexto, contrato.id, { papel: "gestor", nome: "Gestor Modelo", dataInicio: "2027-01-15" }, chave("gestor"));
  await repository.adicionarResponsavelContrato(contexto, contrato.id, { papel: "fiscal_tecnico", nome: "Fiscal de Engenharia Modelo", dataInicio: "2027-01-15" }, chave("fiscal"));
  contrato = (await repository.decidirContrato(contexto, contrato.id, { acao: "ativar", dados: dadosMassa }, contrato.versao, chave("ativar-contrato"))).contrato;

  let obra = await repository.criarObraCorporativa(contexto, {
    patrimonioUnidadeId: predio.id, contractId: contrato.id, orcamentoId: orcamento.id,
    codigo: "OB-2027-01", nome: "Modernização do edifício principal", responsavel: "Coordenação de Obras",
    dataInicio: "2027-01-15", dataFimPrevista: "2027-10-31", valorPrevisto: valor(798000), dados: dadosMassa,
  }, chave("obra"));
  obra = (await repository.decidirObraCorporativa(contexto, obra.id, { acao: "iniciar" }, obra.versao, chave("iniciar-obra"))).obra;
  await repository.registrarDiarioObra(contexto, obra.id, {
    dataRegistro: "2027-01-18", clima: "estavel", efetivo: 12,
    atividades: "Mobilização, isolamento das áreas e levantamentos executivos.", ocorrencias: "Sem ocorrências críticas.", evidencias: [],
  }, chave("diario"));

  const plano = await repository.criarPlanoManutencao(contexto, {
    ativoId: ativo.id, codigo: "PM-01", nome: "Manutenção preventiva da climatização",
    periodicidadeDias: 90, proximaExecucao: "2027-03-01", responsavel: "Equipe de Facilities", dados: dadosMassa,
  }, chave("plano-manutencao"));
  await repository.criarChamadoManutencao(contexto, {
    patrimonioUnidadeId: sala.id, ativoId: ativo.id, planoId: plano.id, codigo: "CH-01",
    titulo: "Inspeção preventiva do sistema VRF", descricao: "Verificar filtros, drenos e parâmetros operacionais.",
    tipo: "preventiva", prioridade: "media", dados: dadosMassa,
  }, chave("chamado"));

  const centro = await repository.criarCentroCustoFinanceiro(contexto, {
    codigo: "CC-ENG", nome: "Engenharia e infraestrutura", responsavel: "Gestão Financeira", dados: dadosMassa,
  }, chave("centro-custo"));
  const fonte = await repository.criarFonteFinanceira(contexto, {
    codigo: "FR-01", nome: "Recursos institucionais", tipo: "propria", dados: dadosMassa,
  }, chave("fonte"));
  const financeiro = await repository.criarOrcamentoFinanceiro(contexto, {
    costCenterId: centro.id, fundingSourceId: fonte.id, codigo: "FIN-2027", descricao: "Plano financeiro de infraestrutura",
    ano: 2027, classificacao: "capex", valorInicial: valor(1200000), ajustes: 0, dados: dadosMassa,
  }, chave("orcamento-financeiro"));
  let compromisso = await repository.criarCompromissoFinanceiro(contexto, {
    budgetId: financeiro.id, codigo: "EMP-2027-01", descricao: "Parcela contratual da modernização",
    origemTipo: "manual", beneficiario: empresa.fornecedor, competencia: "2027-01-01", dataVencimento: "2027-02-10",
    valorTotal: valor(200000), dados: dadosMassa,
  }, chave("compromisso"));
  compromisso = (await repository.registrarMovimentoFinanceiro(contexto, compromisso.id, { tipo: "reserva", valor: valor(200000), dados: dadosMassa }, compromisso.versao, chave("reserva"))).compromisso;
  await repository.registrarMovimentoFinanceiro(contexto, compromisso.id, { tipo: "compromisso", valor: valor(200000), dados: dadosMassa }, compromisso.versao, chave("empenho"));

  let convenio = (await repository.listarConvenios(contexto)).find((item) => item.codigo === "CV-2027-01")
    || await repository.criarConvenio(contexto, {
    codigo: "CV-2027-01", numero: "001/2027", titulo: "Programa de eficiência e acessibilidade",
    programa: "Infraestrutura Sustentável", concedente: "Instituição Concedente Modelo", convenente: empresa.nome,
    objeto: "Modernização de instalações com foco em eficiência e acessibilidade", dataInicio: "2027-01-01", dataFim: "2028-06-30",
    valorRepasse: valor(500000), valorContrapartida: valor(50000), dados: dadosMassa,
  }, chave("convenio"));
  if (convenio.status === "rascunho") {
    convenio = await repository.decidirConvenio(contexto, convenio.id, { acao: "ativar" }, convenio.versao, chave("ativar-convenio"));
  }
  const detalheConvenio = await repository.obterConvenio(contexto, convenio.id);
  if (!detalheConvenio.metas.some((item) => item.codigo === "M-01")) {
    await repository.adicionarMetaConvenio(contexto, convenio.id, { codigo: "M-01", descricao: "Requalificar o edifício principal", valorPrevisto: valor(450000), dados: dadosMassa }, chave("meta"));
  }
  if (!detalheConvenio.repasses.some((item) => item.parcela === "1")) {
    await repository.registrarRepasseConvenio(contexto, convenio.id, { tipo: "repasse", parcela: "1", dataPrevista: "2027-02-01", valor: valor(250000), status: "previsto", dados: dadosMassa }, chave("repasse"));
  }

  const requisitoExistente = (await repository.listarRequisitosCompliance(contexto)).find((item) => item.codigo === "REG-ALV-01");
  if (!requisitoExistente) await repository.criarRequisitoCompliance(contexto, {
    patrimonioUnidadeId: predio.id, codigo: "REG-ALV-01", tipo: "alvara", titulo: "Alvará de localização e funcionamento",
    orgaoEmissor: "Órgão licenciador modelo", numeroDocumento: "ALV-2027-001", dataEmissao: "2027-01-10",
    dataValidade: "2028-01-10", responsavel: "Coordenação de Regularidade", status: "regular", criticidade: "alta", dados: dadosMassa,
  }, chave("requisito"));
  await garantirPpciHomologacao(repository, contexto, predio, sala, dadosMassa, chave);
  await garantirUtilidadesHomologacao(repository, contexto, predio, dadosMassa, chave);
  const riscoExistente = (await repository.listarRiscosCompliance(contexto)).find((item) => item.codigo === "RSC-01");
  const risco = riscoExistente || await repository.criarRiscoCompliance(contexto, {
    codigo: "RSC-01", titulo: "Atraso na renovação de licenças", descricao: "Risco de descontinuidade por vencimento documental.",
    probabilidade: 3, impacto: 4, controle: "Agenda de vencimentos e responsáveis definidos", responsavel: "Compliance", dados: dadosMassa,
  }, chave("risco"));
  if (!riscoExistente) await repository.criarAcaoCompliance(contexto, risco.id, {
    titulo: "Revisar agenda regulatória", descricao: "Validar documentos e prazos do próximo ciclo.", responsavel: "Analista de Compliance",
    prazo: "2027-06-30", percentual: 25, status: "em_andamento", dados: dadosMassa,
  }, chave("acao-risco"));

  const documentoExistente = (await repository.listarDocumentos(contexto)).find((item) => item.metadados?.massa === VERSAO_MASSA);
  const documento = documentoExistente || await repository.criarDocumento(contexto, {
    titulo: "Termo de referência da modernização", tipo: "termo_referencia", status: "rascunho", metadados: dadosMassa,
    vinculo: { moduleId: "obras", entidadeTipo: "obra", entidadeId: obra.id },
  }, chave("documento"));
  if (!documentoExistente) await repository.adicionarVersaoDocumento(contexto, documento.id, {
    nomeArquivo: "termo-referencia-modelo.pdf", tipoMime: "application/pdf", tamanhoBytes: 245760,
    sha256: "b7f48c9d1f93c221775d02f0c2e77068f7703a90039240ef46f80a29f2c0189b",
    storageKey: `homologacao/${empresa.tenantId}/termo-referencia-modelo.pdf`, metadados: dadosMassa,
  });
  if (!documentoExistente) {
    const submetido = await repository.decidirDocumento(contexto, documento.id, { acao: "submeter" }, documento.versao);
    await repository.decidirDocumento(contexto, documento.id, { acao: "aprovar" }, submetido.versao);
  }
  const relatorioExistente = (await repository.listarDefinicoesRelatorios(contexto)).some((item) => item.codigo === "REL-EXEC-01");
  if (!relatorioExistente) await repository.criarDefinicaoRelatorio(contexto, {
    codigo: "REL-EXEC-01", nome: "Painel executivo de homologação", descricao: "Visão integrada dos dados fictícios.",
    modulos: ["patrimonio", "planejamento", "orcamentos", "obras", "contratos", "financeiro", "regularidade"],
    configuracao: { periodicidade: "mensal", massa: VERSAO_MASSA }, compartilhado: true,
  }, chave("relatorio"));
  await repository.criarCanalIntegracao(contexto, {
    codigo: "INT-ERP-01", nome: "Canal financeiro de homologação", tipo: "contabil", direcao: "bidirecional",
    configuracaoPublica: { ambiente: "homologacao", autenticacao: "referencia-externa", massa: VERSAO_MASSA }, segredoReferencia: "",
  }, chave("integracao"));

  return { nome: empresa.nome, tenantId: empresa.tenantId, teamId: empresa.teamId, registrosPrincipais: 23 };
}

async function garantirPpciHomologacao(repository, contexto, predio, sala, dadosMassa, chave) {
  let ppci = (await repository.listarPpcis(contexto)).find((item) => item.codigo === "PPCI-01");
  if (!ppci) ppci = await repository.criarPpci(contexto, {
    patrimonioUnidadeId: predio.id, codigo: "PPCI-01", numeroProcesso: "CBM-2027-001",
    titulo: "PPCI do edifício principal", ocupacao: "Administrativo", classificacaoRisco: "medio",
    areaProtegidaM2: predio.areaM2 || 4800, orgaoResponsavel: "Corpo de Bombeiros",
    fase: "concluido", status: "aprovado", dataProtocolo: "2027-01-10", dataAprovacao: "2027-02-15",
    dataValidade: "2028-02-15", responsavel: "Coordenação de Segurança", proximoPasso: "Programar renovação anual", dados: dadosMassa,
  }, chave("ppci"));
  const detalhe = await repository.obterPpci(contexto, ppci.id);
  if (!detalhe.sistemas.some((item) => item.tipo === "alarme")) await repository.criarSistemaPpci(contexto, ppci.id, {
    patrimonioUnidadeId: sala.id, tipo: "alarme", descricao: "Central de detecção e alarme de incêndio",
    quantidade: 1, unidade: "un", conformidade: "conforme", ultimaInspecao: "2027-02-15", proximaInspecao: "2027-08-15",
    responsavel: "Equipe de Facilities", dados: dadosMassa,
  }, chave("ppci-sistema"));
  if (!detalhe.inspecoes.length) await repository.registrarInspecaoPpci(contexto, ppci.id, {
    dataInspecao: "2027-02-15", tipo: "bombeiros", resultado: "conforme", inspetor: "Vistoria técnica modelo",
    observacoes: "Sistemas preventivos aptos para homologação.", evidencias: [],
  }, chave("ppci-inspecao"));
  return ppci;
}

async function garantirUtilidadesHomologacao(repository, contexto, predio, dadosMassa, chave) {
  let medidor = (await repository.listarMedidoresUtilidades(contexto)).find((item) => item.codigo === "MED-001");
  if (!medidor) medidor = await repository.criarMedidorUtilidade(contexto, {
    patrimonioUnidadeId: predio.id, codigo: "MED-001", nome: "Entrada geral de energia",
    recurso: "energia", unidade: "kWh", direcao: "bidirecional", multiplicador: 1,
    identificadorExterno: "MEDIDOR-MODELO", responsavel: "Equipe de Facilities", dados: dadosMassa,
  }, chave("medidor-utilidade"));
  const detalhe = await repository.obterMedidorUtilidade(contexto, medidor.id);
  if (!detalhe.leituras.length) await repository.registrarLeituraUtilidade(contexto, medidor.id, {
    dataLeitura: "2027-02-28T12:00:00.000Z", valor: 18452.75, natureza: "leitura",
    origem: "manual", observacoes: "Leitura fictícia inicial de homologação.",
  }, chave("leitura-utilidade"));
  return medidor;
}

export async function criarMassaHomologacao({ apiUrl, migrationUrl } = {}) {
  if (String(process.env.NODE_ENV || "development").toLowerCase() === "production") {
    throw new Error("A massa fictícia de homologação é bloqueada em produção.");
  }
  const conexaoApi = apiUrl || process.env.PRUMO_DATABASE_URL;
  const conexaoMigracao = migrationUrl || process.env.PRUMO_MIGRATION_DATABASE_URL || conexaoApi;
  if (!conexaoApi || !conexaoMigracao) throw new Error("Configure PRUMO_DATABASE_URL e PRUMO_MIGRATION_DATABASE_URL.");
  const admin = new Client({ connectionString: conexaoMigracao });
  const repository = criarRepositorioPostgres({ connectionString: conexaoApi });
  const resultados = [];
  try {
    await admin.connect();
    for (const empresa of EMPRESAS_HOMOLOGACAO) {
      const existente = await prepararEmpresa(admin, empresa);
      if (existente) {
        const contexto = { identity: { subject: IDENTIDADE }, tenantId: empresa.tenantId, teamId: empresa.teamId };
        const unidades = await repository.listarUnidadesPatrimoniais(contexto);
        const predio = unidades.find((item) => item.codigo === "P-01"), sala = unidades.find((item) => item.codigo === "SL-01");
        if (predio && sala) {
          const dados = { massa: VERSAO_MASSA, ficticio: true };
          const chave = (item) => `${VERSAO_MASSA}:${empresa.tenantId}:${item}`;
          await garantirPpciHomologacao(repository, contexto, predio, sala, dados, chave);
          await garantirUtilidadesHomologacao(repository, contexto, predio, dados, chave);
        }
        resultados.push({ nome: empresa.nome, tenantId: empresa.tenantId, teamId: empresa.teamId, status: "atualizada" });
      } else resultados.push({ ...(await popularEmpresa(repository, empresa)), status: "criada" });
    }
    return { versao: VERSAO_MASSA, identidade: IDENTIDADE, empresas: resultados };
  } finally {
    await repository.fechar();
    if (admin._connected) await admin.end();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  criarMassaHomologacao()
    .then((resultado) => {
      console.log(`Massa ${resultado.versao} concluída para ${resultado.empresas.length} empresas.`);
      resultado.empresas.forEach((empresa) => console.log(`- ${empresa.nome}: ${empresa.status}`));
    })
    .catch((error) => { console.error(`Falha ao criar massa de homologação: ${error.message}`); process.exitCode = 1; });
}
