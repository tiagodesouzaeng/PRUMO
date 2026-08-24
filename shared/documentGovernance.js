export const TIPOS_ENTIDADE_DOCUMENTAL = [
  { moduleId: "patrimonio", entidadeTipo: "unidade_patrimonial", rotulo: "Cliente, Site, Prédio ou Sala" },
  { moduleId: "patrimonio", entidadeTipo: "ativo", rotulo: "Ativo patrimonial" },
  { moduleId: "planejamento", entidadeTipo: "solicitacao", rotulo: "Solicitação e investimento" },
  { moduleId: "orcamentos", entidadeTipo: "orcamento", rotulo: "Orçamento" },
  { moduleId: "suprimentos", entidadeTipo: "processo_contratacao", rotulo: "Processo de contratação" },
  { moduleId: "suprimentos", entidadeTipo: "pedido", rotulo: "Pedido de compra" },
  { moduleId: "contratos", entidadeTipo: "contrato", rotulo: "Contrato ou ata" },
  { moduleId: "obras", entidadeTipo: "obra", rotulo: "Obra ou reforma" },
  { moduleId: "medicoes", entidadeTipo: "medicao", rotulo: "Medição" },
  { moduleId: "manutencao", entidadeTipo: "chamado", rotulo: "Chamado de manutenção" },
  { moduleId: "manutencao", entidadeTipo: "ordem_manutencao", rotulo: "Ordem de manutenção" },
  { moduleId: "regularidade", entidadeTipo: "requisito_regularidade", rotulo: "Requisito de regularidade" },
  { moduleId: "regularidade", entidadeTipo: "ppci", rotulo: "PPCI" },
  { moduleId: "regularidade", entidadeTipo: "sistema_ppci", rotulo: "Sistema preventivo do PPCI" },
  { moduleId: "utilidades", entidadeTipo: "medidor", rotulo: "Medidor de utilidade" },
  { moduleId: "convenios", entidadeTipo: "convenio", rotulo: "Convênio ou repasse" },
];

const CHAVES = new Set(TIPOS_ENTIDADE_DOCUMENTAL.map((item) => `${item.moduleId}:${item.entidadeTipo}`));

export function validarTipoEntidadeDocumental(vinculo = {}) {
  const normalizado = {
    moduleId: String(vinculo.moduleId || "").trim(),
    entidadeTipo: String(vinculo.entidadeTipo || "").trim(),
    entidadeId: String(vinculo.entidadeId || "").trim(),
  };
  if (!normalizado.entidadeId || !CHAVES.has(`${normalizado.moduleId}:${normalizado.entidadeTipo}`)) {
    throw new Error("Selecione uma entidade válida para vincular o documento.");
  }
  return normalizado;
}

export function resolverTransicaoDocumento(documento, acao, { versoes = documento?.versaoAtual } = {}) {
  const status = documento?.status || "rascunho";
  const transicoes = {
    submeter: ["rascunho", "em_revisao"],
    devolver: ["em_revisao", "rascunho"],
    aprovar: ["em_revisao", "aprovado"],
    arquivar: ["aprovado", "arquivado"],
  };
  const transicao = transicoes[acao];
  if (!transicao || transicao[0] !== status) throw new Error("Transição documental não permitida para o estado atual.");
  if (acao === "submeter" && Number(versoes || 0) < 1) throw new Error("Inclua ao menos uma versão antes de submeter o documento.");
  return transicao[1];
}
