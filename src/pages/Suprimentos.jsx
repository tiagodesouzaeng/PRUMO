import { useEffect, useMemo, useState } from "react";
import {
  criarClientePrumo,
  obterConfiguracaoInfraestrutura,
  obterContextoDesenvolvimento,
} from "../services/infraestruturaCorporativa";

const STATUS = {
  rascunho: "Rascunho",
  planejamento: "Planejamento",
  pesquisa_precos: "Pesquisa de preços",
  selecao: "Seleção",
  aprovada: "Aprovada",
  pedido_emitido: "Pedido emitido",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const ACOES = {
  rascunho: [["iniciar_planejamento", "Iniciar planejamento"]],
  planejamento: [["abrir_pesquisa", "Abrir pesquisa"]],
  pesquisa_precos: [["iniciar_selecao", "Iniciar seleção"]],
  selecao: [
    ["aprovar", "Aprovar menor proposta"],
    ["devolver", "Devolver"],
  ],
};
const vazioProcesso = {
  codigo: "",
  titulo: "",
  objeto: "",
  demandId: "",
  orcamentoId: "",
  tipo: "servico",
  regime: "publico",
  criterioJulgamento: "menor_preco",
  valorEstimado: 0,
  estudoTecnico: { necessidade: "", solucao: "", requisitos: "" },
  riscos: [],
  termoReferencia: { escopo: "", prazo: "", criteriosAceite: "" },
  dados: {},
};

function chave() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}
function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
function proximoCodigo(prefixo, itens) {
  const maior = itens.reduce(
    (max, item) =>
      Math.max(
        max,
        Number(String(item.codigo || "").match(/(\d+)$/)?.[1]) || 0,
      ),
    0,
  );
  return `${prefixo}-${String(maior + 1).padStart(3, "0")}`;
}
function prepararProcesso(item) {
  return {
    demandId: item.demandId || "",
    orcamentoId: item.orcamentoId || "",
    codigo: item.codigo,
    titulo: item.titulo,
    objeto: item.objeto,
    tipo: item.tipo,
    regime: item.regime,
    criterioJulgamento: item.criterioJulgamento,
    valorEstimado: Number(item.valorEstimado) || 0,
    estudoTecnico: item.estudoTecnico || {},
    riscos: item.riscos || [],
    termoReferencia: item.termoReferencia || {},
    dados: item.dados || {},
  };
}

export default function Suprimentos() {
  const cliente = useMemo(() => {
    const config = obterConfiguracaoInfraestrutura();
    return config.apiConfigurada
      ? criarClientePrumo({
          baseUrl: config.apiUrl,
          obterContexto: () => obterContextoDesenvolvimento(),
        })
      : null;
  }, []);
  const [dados, setDados] = useState({
    processos: [],
    fornecedores: [],
    demandas: [],
    orcamentos: [],
    pedidos: [],
  });
  const [aba, setAba] = useState("processos");
  const [filtro, setFiltro] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(vazioProcesso);
  const [selecionado, setSelecionado] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    if (!cliente) {
      setMensagem(
        "Configure a API local para utilizar Suprimentos e Contratações.",
      );
      setCarregando(false);
      return;
    }
    try {
      const [processos, fornecedores, demandas, orcamentos, pedidos] =
        await Promise.all([
          cliente.listarProcessosContratacao(),
          cliente.listarFornecedores(),
          cliente.listarDemandasInvestimento({ status: "incorporada" }),
          cliente.listar("orcamentos"),
          cliente.listarPedidosCompra(),
        ]);
      setDados({ processos, fornecedores, demandas, orcamentos, pedidos });
      setMensagem("");
    } catch (erro) {
      setMensagem(erro.message);
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    carregar();
  }, []);

  const processos = useMemo(
    () =>
      dados.processos.filter(
        (item) =>
          !filtro ||
          `${item.codigo} ${item.titulo} ${item.objeto}`
            .toLocaleLowerCase("pt-BR")
            .includes(filtro.toLocaleLowerCase("pt-BR")),
      ),
    [dados.processos, filtro],
  );
  const indicadores = useMemo(
    () => ({
      total: dados.processos.length,
      planejamento: dados.processos.filter((x) =>
        ["rascunho", "planejamento"].includes(x.status),
      ).length,
      selecao: dados.processos.filter((x) =>
        ["pesquisa_precos", "selecao"].includes(x.status),
      ).length,
      contratado: dados.pedidos.reduce(
        (s, x) => s + Number(x.valorTotal || 0),
        0,
      ),
    }),
    [dados],
  );

  function novoProcesso(item = null) {
    setForm(
      item
        ? { ...item }
        : {
            ...vazioProcesso,
            estudoTecnico: { ...vazioProcesso.estudoTecnico },
            termoReferencia: { ...vazioProcesso.termoReferencia },
            riscos: [],
            codigo: proximoCodigo("PC", dados.processos),
          },
    );
    setModal("processo");
  }
  async function salvarProcesso(evento) {
    evento.preventDefault();
    setSalvando(true);
    try {
      const payload = prepararProcesso(form);
      if (form.id)
        await cliente.atualizarProcessoContratacao(
          form.id,
          payload,
          form.versao,
        );
      else await cliente.criarProcessoContratacao(payload, chave());
      setModal(null);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    } finally {
      setSalvando(false);
    }
  }
  async function abrirProcesso(item) {
    try {
      setSelecionado(await cliente.obterProcessoContratacao(item.id));
    } catch (erro) {
      setMensagem(erro.message);
    }
  }
  async function decidir(acao) {
    const justificativa = ["devolver", "cancelar"].includes(acao)
      ? globalThis.prompt("Informe a justificativa:")
      : "";
    if (justificativa === null) return;
    try {
      const resultado = await cliente.decidirProcessoContratacao(
        selecionado.id,
        { acao, justificativa, dados: {} },
        selecionado.versao,
        chave(),
      );
      setSelecionado(
        await cliente.obterProcessoContratacao(resultado.processo.id),
      );
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }
  async function salvarFornecedor(evento) {
    evento.preventDefault();
    setSalvando(true);
    const corpo = Object.fromEntries(new FormData(evento.currentTarget));
    try {
      await cliente.criarFornecedor({ ...corpo, dados: {} }, chave());
      setModal(null);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    } finally {
      setSalvando(false);
    }
  }
  async function salvarCotacao(evento) {
    evento.preventDefault();
    setSalvando(true);
    const corpo = Object.fromEntries(new FormData(evento.currentTarget));
    try {
      await cliente.registrarCotacao(
        selecionado.id,
        {
          supplierId: corpo.supplierId,
          valorTotal: Number(corpo.valorTotal),
          prazoEntregaDias: Number(corpo.prazoEntregaDias || 0),
          validadeDias: Number(corpo.validadeDias || 30),
          proposta: { observacao: corpo.observacao || "" },
        },
        chave(),
      );
      setModal(null);
      setSelecionado(await cliente.obterProcessoContratacao(selecionado.id));
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    } finally {
      setSalvando(false);
    }
  }
  async function emitirPedido(evento) {
    evento.preventDefault();
    setSalvando(true);
    const corpo = Object.fromEntries(new FormData(evento.currentTarget));
    try {
      await cliente.emitirPedidoCompra(
        selecionado.id,
        {
          supplierId: corpo.supplierId,
          quoteId: corpo.quoteId || "",
          codigo: corpo.codigo,
          valorTotal: Number(corpo.valorTotal),
          dataPrevista: corpo.dataPrevista || undefined,
          dados: {},
        },
        selecionado.versao,
        chave(),
      );
      setModal(null);
      setSelecionado(null);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    } finally {
      setSalvando(false);
    }
  }
  async function receberPedido(evento) {
    evento.preventDefault();
    setSalvando(true);
    const corpo = Object.fromEntries(new FormData(evento.currentTarget));
    try {
      await cliente.registrarRecebimentoPedido(
        modal.pedido.id,
        {
          valorRecebido: Number(corpo.valorRecebido),
          aceite: corpo.aceite,
          observacao: corpo.observacao || "",
        },
        chave(),
      );
      setModal(null);
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="sigiu-page sigiu-procurement">
      <header className="sigiu-page-heading sigiu-page-heading--modulo sigiu-procurement-header">
        <div>
          <span className="sigiu-page-eyebrow">Suprimentos e aquisições</span>
          <h1>Suprimentos e contratações</h1>
          <p>
            Da demanda incorporada ao pedido recebido, com pesquisa, decisão e
            rastreabilidade.
          </p>
        </div>
        <button className="sigiu-primary" onClick={() => novoProcesso()}>
          + Novo processo
        </button>
      </header>
      {mensagem && <div className="sigiu-feedback">{mensagem}</div>}
      <section className="sigiu-procurement-kpis">
        <article>
          <span>Processos</span>
          <strong>{indicadores.total}</strong>
        </article>
        <article>
          <span>Em planejamento</span>
          <strong>{indicadores.planejamento}</strong>
        </article>
        <article>
          <span>Pesquisa e seleção</span>
          <strong>{indicadores.selecao}</strong>
        </article>
        <article>
          <span>Pedidos emitidos</span>
          <strong>{moeda(indicadores.contratado)}</strong>
        </article>
      </section>
      <nav className="sigiu-planning-tabs">
        <button
          className={aba === "processos" ? "active" : ""}
          onClick={() => setAba("processos")}
        >
          Processos
        </button>
        <button
          className={aba === "fornecedores" ? "active" : ""}
          onClick={() => setAba("fornecedores")}
        >
          Fornecedores
        </button>
        <button
          className={aba === "pedidos" ? "active" : ""}
          onClick={() => setAba("pedidos")}
        >
          Pedidos e recebimentos
        </button>
      </nav>
      {carregando ? (
        <div className="sigiu-empty">Carregando suprimentos…</div>
      ) : aba === "processos" ? (
        <>
          <div className="sigiu-planning-toolbar">
            <input
              aria-label="Pesquisar processos"
              placeholder="Pesquisar código, título ou objeto"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          <div className="sigiu-planning-table">
            <table>
              <thead>
                <tr>
                  <th>Processo</th>
                  <th>Origem</th>
                  <th>Valor estimado</th>
                  <th>Regime</th>
                  <th>Etapa</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {processos.map((item) => (
                  <tr key={item.id} onClick={() => abrirProcesso(item)}>
                    <td>
                      <b>{item.codigo}</b>
                      <span>{item.titulo}</span>
                    </td>
                    <td>
                      {item.demandId
                        ? dados.demandas.find((x) => x.id === item.demandId)
                            ?.codigo || "Demanda"
                        : "Orçamento"}
                    </td>
                    <td>{moeda(item.valorEstimado)}</td>
                    <td>{item.regime}</td>
                    <td>
                      <span className={`sigiu-status status-${item.status}`}>
                        {STATUS[item.status]}
                      </span>
                    </td>
                    <td>
                      <button className="sigiu-link">Abrir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!processos.length && (
              <div className="sigiu-empty">
                Nenhum processo de contratação iniciado.
              </div>
            )}
          </div>
        </>
      ) : aba === "fornecedores" ? (
        <section className="sigiu-procurement-section">
          <div className="sigiu-section-title">
            <div>
              <h2>Fornecedores compartilhados</h2>
              <p>Cadastro único para cotações, pedidos e futuros contratos.</p>
            </div>
            <button onClick={() => setModal("fornecedor")}>
              + Novo fornecedor
            </button>
          </div>
          <div className="sigiu-procurement-grid">
            {dados.fornecedores.map((item) => (
              <article key={item.id}>
                <span>
                  {item.codigo} · {item.qualificacao}
                </span>
                <h3>{item.razaoSocial}</h3>
                <p>{item.documento || "Documento não informado"}</p>
                <footer>
                  <small>{item.email || item.telefone || "Sem contato"}</small>
                  <b>{item.status}</b>
                </footer>
              </article>
            ))}
          </div>
          {!dados.fornecedores.length && (
            <div className="sigiu-empty">Nenhum fornecedor cadastrado.</div>
          )}
        </section>
      ) : (
        <section className="sigiu-procurement-section">
          <div className="sigiu-section-title">
            <div>
              <h2>Pedidos e recebimentos</h2>
              <p>Saldo físico-financeiro e aceite dos fornecimentos.</p>
            </div>
          </div>
          <div className="sigiu-planning-table">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Processo</th>
                  <th>Total</th>
                  <th>Recebido</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dados.pedidos.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>{item.codigo}</b>
                    </td>
                    <td>
                      {
                        dados.processos.find((x) => x.id === item.processId)
                          ?.codigo
                      }
                    </td>
                    <td>{moeda(item.valorTotal)}</td>
                    <td>{moeda(item.valorRecebido)}</td>
                    <td>
                      <span className={`sigiu-status status-${item.status}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {item.status !== "recebido" &&
                        item.status !== "cancelado" && (
                          <button
                            className="sigiu-link"
                            onClick={() =>
                              setModal({ tipo: "recebimento", pedido: item })
                            }
                          >
                            Receber
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!dados.pedidos.length && (
              <div className="sigiu-empty">Nenhum pedido emitido.</div>
            )}
          </div>
        </section>
      )}

      {modal === "processo" && (
        <div className="sigiu-modal-backdrop">
          <form
            className="sigiu-modal sigiu-procurement-modal"
            onSubmit={salvarProcesso}
          >
            <header>
              <div>
                <span>PLANEJAMENTO DA CONTRATAÇÃO</span>
                <h2>{form.id ? "Editar processo" : "Novo processo"}</h2>
              </div>
              <button type="button" onClick={() => setModal(null)}>
                ×
              </button>
            </header>
            <div className="sigiu-form-grid">
              <label>
                Código
                <input
                  required
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                />
              </label>
              <label className="span-2">
                Título
                <input
                  required
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                />
              </label>
              <label>
                Demanda incorporada
                <select
                  value={form.demandId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      demandId: e.target.value,
                      orcamentoId: e.target.value ? "" : form.orcamentoId,
                    })
                  }
                >
                  <option value="">Sem demanda</option>
                  {dados.demandas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.codigo} · {item.titulo}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Orçamento
                <select
                  value={form.orcamentoId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      orcamentoId: e.target.value,
                      demandId: e.target.value ? "" : form.demandId,
                    })
                  }
                >
                  <option value="">Sem orçamento</option>
                  {dados.orcamentos.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Valor estimado
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valorEstimado}
                  onChange={(e) =>
                    setForm({ ...form, valorEstimado: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Tipo
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  <option value="material">Material</option>
                  <option value="servico">Serviço</option>
                  <option value="obra">Obra</option>
                  <option value="solucao_integrada">Solução integrada</option>
                </select>
              </label>
              <label>
                Regime
                <select
                  value={form.regime}
                  onChange={(e) => setForm({ ...form, regime: e.target.value })}
                >
                  <option value="publico">Setor público</option>
                  <option value="federacao">Federação</option>
                  <option value="privado">Privado</option>
                </select>
              </label>
              <label>
                Julgamento
                <select
                  value={form.criterioJulgamento}
                  onChange={(e) =>
                    setForm({ ...form, criterioJulgamento: e.target.value })
                  }
                >
                  <option value="menor_preco">Menor preço</option>
                  <option value="maior_desconto">Maior desconto</option>
                  <option value="tecnica_preco">Técnica e preço</option>
                  <option value="melhor_tecnica">Melhor técnica</option>
                </select>
              </label>
              <label className="span-3">
                Objeto
                <textarea
                  required
                  rows="3"
                  value={form.objeto}
                  onChange={(e) => setForm({ ...form, objeto: e.target.value })}
                />
              </label>
            </div>
            <section className="sigiu-procurement-planning">
              <h3>Estudo técnico preliminar</h3>
              <div className="sigiu-form-grid">
                <label>
                  Necessidade
                  <textarea
                    rows="3"
                    value={form.estudoTecnico.necessidade || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        estudoTecnico: {
                          ...form.estudoTecnico,
                          necessidade: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Solução proposta
                  <textarea
                    rows="3"
                    value={form.estudoTecnico.solucao || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        estudoTecnico: {
                          ...form.estudoTecnico,
                          solucao: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Requisitos
                  <textarea
                    rows="3"
                    value={form.estudoTecnico.requisitos || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        estudoTecnico: {
                          ...form.estudoTecnico,
                          requisitos: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              </div>
              <div className="sigiu-procurement-risk-title">
                <h3>Matriz de riscos</h3>
                <button type="button" onClick={() => setForm({ ...form, riscos: [...(form.riscos || []), { descricao: "", probabilidade: "media", impacto: "medio", mitigacao: "" }] })}>+ Adicionar risco</button>
              </div>
              <div className="sigiu-procurement-risk-list">
                {(form.riscos || []).map((risco, indice) => {
                  const atualizarRisco = (campo, valor) => setForm({ ...form, riscos: form.riscos.map((item, posicao) => posicao === indice ? { ...item, [campo]: valor } : item) });
                  return <article key={indice}>
                    <label>Risco<input value={risco.descricao || ""} onChange={(e) => atualizarRisco("descricao", e.target.value)} /></label>
                    <label>Probabilidade<select value={risco.probabilidade || "media"} onChange={(e) => atualizarRisco("probabilidade", e.target.value)}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></select></label>
                    <label>Impacto<select value={risco.impacto || "medio"} onChange={(e) => atualizarRisco("impacto", e.target.value)}><option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option></select></label>
                    <label>Mitigação<input value={risco.mitigacao || ""} onChange={(e) => atualizarRisco("mitigacao", e.target.value)} /></label>
                    <button type="button" aria-label="Remover risco" onClick={() => setForm({ ...form, riscos: form.riscos.filter((_, posicao) => posicao !== indice) })}>×</button>
                  </article>;
                })}
                {!form.riscos?.length && <p>Adicione os riscos, impactos e respectivas medidas de mitigação.</p>}
              </div>
              <h3>Termo de referência</h3>
              <div className="sigiu-form-grid">
                <label>
                  Escopo
                  <textarea
                    rows="3"
                    value={form.termoReferencia.escopo || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        termoReferencia: {
                          ...form.termoReferencia,
                          escopo: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Prazo
                  <input
                    value={form.termoReferencia.prazo || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        termoReferencia: {
                          ...form.termoReferencia,
                          prazo: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Critérios de aceite
                  <textarea
                    rows="3"
                    value={form.termoReferencia.criteriosAceite || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        termoReferencia: {
                          ...form.termoReferencia,
                          criteriosAceite: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              </div>
            </section>
            <footer>
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                className="sigiu-primary"
                disabled={salvando || (!form.demandId && !form.orcamentoId)}
              >
                {salvando ? "Salvando…" : "Salvar processo"}
              </button>
            </footer>
          </form>
        </div>
      )}
      {modal === "fornecedor" && (
        <div className="sigiu-modal-backdrop">
          <form
            className="sigiu-modal sigiu-planning-small"
            onSubmit={salvarFornecedor}
          >
            <header>
              <h2>Novo fornecedor</h2>
              <button type="button" onClick={() => setModal(null)}>
                ×
              </button>
            </header>
            <label>
              Código
              <input
                name="codigo"
                defaultValue={proximoCodigo("F", dados.fornecedores)}
                required
              />
            </label>
            <label>
              Razão social
              <input name="razaoSocial" required />
            </label>
            <label>
              Nome fantasia
              <input name="nomeFantasia" />
            </label>
            <label>
              CPF/CNPJ
              <input name="documento" />
            </label>
            <div className="sigiu-form-grid">
              <label>
                E-mail
                <input name="email" type="email" />
              </label>
              <label>
                Telefone
                <input name="telefone" />
              </label>
              <label>
                Qualificação
                <select name="qualificacao">
                  <option value="pendente">Pendente</option>
                  <option value="qualificado">Qualificado</option>
                  <option value="restrito">Restrito</option>
                </select>
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button className="sigiu-primary" disabled={salvando}>
                Cadastrar
              </button>
            </footer>
          </form>
        </div>
      )}
      {modal === "cotacao" && (
        <div className="sigiu-modal-backdrop">
          <form
            className="sigiu-modal sigiu-planning-small"
            onSubmit={salvarCotacao}
          >
            <header>
              <h2>Registrar proposta</h2>
              <button type="button" onClick={() => setModal(null)}>
                ×
              </button>
            </header>
            <label>
              Fornecedor
              <select name="supplierId" required>
                <option value="">Selecione</option>
                {dados.fornecedores
                  .filter((x) => x.status === "ativo")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.codigo} · {item.razaoSocial}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Valor total
              <input
                name="valorTotal"
                type="number"
                min="0.01"
                step="0.01"
                required
              />
            </label>
            <div className="sigiu-form-grid">
              <label>
                Validade (dias)
                <input
                  name="validadeDias"
                  type="number"
                  min="0"
                  defaultValue="30"
                />
              </label>
              <label>
                Entrega (dias)
                <input
                  name="prazoEntregaDias"
                  type="number"
                  min="0"
                  defaultValue="0"
                />
              </label>
            </div>
            <label>
              Observação
              <textarea name="observacao" rows="3" />
            </label>
            <footer>
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button className="sigiu-primary" disabled={salvando}>
                Registrar proposta
              </button>
            </footer>
          </form>
        </div>
      )}
      {modal === "pedido" && (
        <div className="sigiu-modal-backdrop">
          <form
            className="sigiu-modal sigiu-planning-small"
            onSubmit={emitirPedido}
          >
            <header>
              <h2>Emitir pedido</h2>
              <button type="button" onClick={() => setModal(null)}>
                ×
              </button>
            </header>
            {(() => {
              const vencedora =
                selecionado.cotacoes.find((x) => x.status === "vencedora") ||
                selecionado.cotacoes[0];
              return (
                <>
                  <input
                    type="hidden"
                    name="supplierId"
                    value={vencedora?.supplierId || ""}
                  />
                  <input
                    type="hidden"
                    name="quoteId"
                    value={vencedora?.id || ""}
                  />
                  <label>
                    Código
                    <input
                      name="codigo"
                      defaultValue={proximoCodigo("PED", dados.pedidos)}
                      required
                    />
                  </label>
                  <label>
                    Valor total
                    <input
                      name="valorTotal"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={
                        vencedora?.valorTotal || selecionado.valorEstimado
                      }
                      required
                    />
                  </label>
                  <label>
                    Previsão de entrega
                    <input name="dataPrevista" type="date" />
                  </label>
                </>
              );
            })()}
            <footer>
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button className="sigiu-primary" disabled={salvando}>
                Emitir pedido
              </button>
            </footer>
          </form>
        </div>
      )}
      {modal?.tipo === "recebimento" && (
        <div className="sigiu-modal-backdrop">
          <form
            className="sigiu-modal sigiu-planning-small"
            onSubmit={receberPedido}
          >
            <header>
              <h2>Registrar recebimento</h2>
              <button type="button" onClick={() => setModal(null)}>
                ×
              </button>
            </header>
            <p>
              Saldo:{" "}
              <b>
                {moeda(modal.pedido.valorTotal - modal.pedido.valorRecebido)}
              </b>
            </p>
            <label>
              Valor recebido
              <input
                name="valorRecebido"
                type="number"
                min="0.01"
                max={modal.pedido.valorTotal - modal.pedido.valorRecebido}
                step="0.01"
                required
              />
            </label>
            <label>
              Aceite
              <select name="aceite">
                <option value="aceito">Aceito</option>
                <option value="aceito_com_ressalva">Aceito com ressalva</option>
                <option value="rejeitado">Rejeitado</option>
              </select>
            </label>
            <label>
              Observação
              <textarea name="observacao" rows="3" />
            </label>
            <footer>
              <button type="button" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button className="sigiu-primary" disabled={salvando}>
                Registrar
              </button>
            </footer>
          </form>
        </div>
      )}
      {selecionado && (
        <div
          className="sigiu-drawer-backdrop"
          onClick={() => setSelecionado(null)}
        >
          <aside
            className="sigiu-procurement-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <span>{selecionado.codigo}</span>
                <h2>{selecionado.titulo}</h2>
              </div>
              <button onClick={() => setSelecionado(null)}>×</button>
            </header>
            <div className="sigiu-procurement-stage">
              <span className={`sigiu-status status-${selecionado.status}`}>
                {STATUS[selecionado.status]}
              </span>
              <b>{moeda(selecionado.valorEstimado)}</b>
              <p>{selecionado.objeto}</p>
            </div>
            <div className="sigiu-detail-actions">
              {(ACOES[selecionado.status] || []).map(([acao, rotulo]) => (
                <button key={acao} onClick={() => decidir(acao)}>
                  {rotulo}
                </button>
              ))}
              {["rascunho", "planejamento"].includes(selecionado.status) && (
                <button
                  onClick={() => {
                    setSelecionado(null);
                    novoProcesso(selecionado);
                  }}
                >
                  Editar planejamento
                </button>
              )}
              {selecionado.status === "aprovada" && (
                <button
                  className="sigiu-primary"
                  onClick={() => setModal("pedido")}
                >
                  Emitir pedido
                </button>
              )}
            </div>
            <section className="sigiu-procurement-docs">
              <article>
                <span>Estudo técnico</span>
                <b>
                  {selecionado.estudoTecnico?.necessidade ||
                    "Necessidade não preenchida"}
                </b>
                <p>{selecionado.estudoTecnico?.solucao}</p>
              </article>
              <article>
                <span>Termo de referência</span>
                <b>
                  {selecionado.termoReferencia?.escopo ||
                    "Escopo não preenchido"}
                </b>
                <p>{selecionado.termoReferencia?.criteriosAceite}</p>
              </article>
              <article>
                <span>Matriz de riscos</span>
                <b>{selecionado.riscos?.length || 0} risco(s)</b>
                <p>
                  {selecionado.riscos?.length
                    ? "Riscos registrados no planejamento."
                    : "Inclua riscos antes de abrir a pesquisa."}
                </p>
              </article>
            </section>
            <section className="sigiu-procurement-quotes">
              <div className="sigiu-section-title">
                <div>
                  <h3>Pesquisa de preços</h3>
                  <p>
                    {selecionado.cotacoes?.length || 0} proposta(s)
                    registrada(s)
                  </p>
                </div>
                {["pesquisa_precos", "selecao"].includes(
                  selecionado.status,
                ) && (
                  <button onClick={() => setModal("cotacao")}>
                    + Proposta
                  </button>
                )}
              </div>
              {selecionado.cotacoes?.map((item) => (
                <article key={item.id}>
                  <div>
                    <b>
                      {dados.fornecedores.find((x) => x.id === item.supplierId)
                        ?.razaoSocial || "Fornecedor"}
                    </b>
                    <span>
                      {item.prazoEntregaDias} dias · {item.status}
                    </span>
                  </div>
                  <strong>{moeda(item.valorTotal)}</strong>
                </article>
              ))}
              {!selecionado.cotacoes?.length && (
                <div className="sigiu-empty">Pesquisa ainda sem propostas.</div>
              )}
            </section>
            <section className="sigiu-timeline">
              <h3>Trilha de decisões</h3>
              {selecionado.decisoes?.map((item) => (
                <article key={item.id}>
                  <i />
                  <div>
                    <b>{STATUS[item.statusNovo] || item.acao}</b>
                    <span>
                      {item.decididoPor} ·{" "}
                      {new Date(item.decididoEm).toLocaleString("pt-BR")}
                    </span>
                    {item.justificativa && <p>{item.justificativa}</p>}
                  </div>
                </article>
              ))}
              {!selecionado.decisoes?.length && (
                <p>Nenhuma decisão registrada.</p>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
