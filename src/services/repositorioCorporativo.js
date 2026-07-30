import {
  criarClientePrumo,
  obterConfiguracaoInfraestrutura,
  obterContextoDesenvolvimento,
} from "./infraestruturaCorporativa.js";

const MAPEAMENTO_KEY = "prumo.repositorios.corporativos";

function criarClientePadrao() {
  const configuracao = obterConfiguracaoInfraestrutura();
  const contexto = obterContextoDesenvolvimento();
  if (!configuracao.apiConfigurada || !contexto) return null;
  return criarClientePrumo({
    baseUrl: configuracao.apiUrl,
    obterContexto: () => contexto,
  });
}

function lerMapeamento(storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage?.getItem(MAPEAMENTO_KEY) || "{}");
  } catch {
    return {};
  }
}

function salvarMapeamento(mapa, storage = globalThis.localStorage) {
  storage?.setItem(MAPEAMENTO_KEY, JSON.stringify(mapa));
}

function mapearOrcamentoCorporativo(item, mapa) {
  const dados = item.dados || {};
  const idLocal = String(dados.idOrigemMigracao || dados.id || item.id);
  mapa[idLocal] = { id: item.id, versao: item.versao };
  return {
    ...dados,
    id: idLocal,
    nome: item.nome || dados.nome,
    _corporativo: { id: item.id, versao: item.versao },
  };
}

export async function carregarOrcamentosCorporativosSeAtivo({
  cliente = criarClientePadrao(),
  storage = globalThis.localStorage,
} = {}) {
  if (!cliente) return { modo: "local", orcamentos: [] };
  const transicoes = await cliente.listarTransicoesRepositorio();
  const transicao = transicoes.find((item) => item.dominioId === "orcamentos");
  if (!transicao || transicao.modo === "local") return { modo: "local", orcamentos: [] };
  const registros = await cliente.listar("orcamentos");
  const mapa = lerMapeamento(storage);
  const orcamentos = registros.map((item) => mapearOrcamentoCorporativo(item, mapa));
  salvarMapeamento(mapa, storage);
  return { modo: transicao.modo, orcamentos };
}

export async function sincronizarOrcamentosCorporativos(
  orcamentos,
  {
    cliente = criarClientePadrao(),
    storage = globalThis.localStorage,
  } = {},
) {
  if (!cliente) return { sincronizados: 0, modo: "local" };
  const transicoes = await cliente.listarTransicoesRepositorio();
  const transicao = transicoes.find((item) => item.dominioId === "orcamentos");
  if (!transicao || transicao.modo === "local") return { sincronizados: 0, modo: "local" };
  const mapa = lerMapeamento(storage);
  let sincronizados = 0;
  for (const orcamento of orcamentos) {
    const vinculo = mapa[orcamento.id] || orcamento._corporativo;
    const dados = { ...orcamento };
    delete dados._corporativo;
    let salvo;
    if (vinculo?.id && vinculo?.versao) {
      salvo = await cliente.atualizar(
        "orcamentos",
        vinculo.id,
        { nome: orcamento.nome, dados },
        vinculo.versao,
      );
    } else {
      salvo = await cliente.criar(
        "orcamentos",
        { nome: orcamento.nome, dados },
        `repositorio:orcamento:${orcamento.id}`,
      );
    }
    mapa[orcamento.id] = { id: salvo.id, versao: salvo.versao };
    sincronizados += 1;
  }
  salvarMapeamento(mapa, storage);
  return { sincronizados, modo: transicao.modo };
}
