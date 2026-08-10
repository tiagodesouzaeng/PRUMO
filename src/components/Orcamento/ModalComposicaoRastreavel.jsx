import { useEffect, useMemo, useState } from "react";
import {
  avaliarComponenteComposicao,
  resumirQualidadeComposicao,
} from "../../domain/composicoes";
import { gerarRelatorioPrecosPorUf } from "../../domain/basesPrecos";
import { UFS_SINAPI } from "../../services/sinapiImport";

const moeda = (valor) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
}).format(Number(valor) || 0);

const numero = (valor) => Number(valor || 0).toLocaleString("pt-BR", {
  maximumFractionDigits: 8,
});

export default function ModalComposicaoRastreavel({
  referencia,
  basesPrecos,
  fechar,
  tituloContexto = "Memória da composição",
  ufSelecionada = "RS",
}) {
  const [trilha, setTrilha] = useState([referencia]);
  const [componentes, setComponentes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [alerta, setAlerta] = useState("");
  const [abaAtiva, setAbaAtiva] = useState(referencia.tipo === "insumo" ? "precos" : "analitica");
  const atual = trilha.at(-1);
  const baseAtual = useMemo(
    () => basesPrecos.bases.find((base) => base.id === atual.basePrecoId),
    [basesPrecos.bases, atual.basePrecoId],
  );

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setAlerta("");
    basesPrecos.carregarItensComposicao(atual.basePrecoId, atual.codigo, ufSelecionada)
      .then((itens) => {
        if (ativo) setComponentes(itens || []);
      })
      .catch(() => {
        if (ativo) setComponentes([]);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => { ativo = false; };
  }, [atual.basePrecoId, atual.codigo, ufSelecionada]);
  const qualidade = useMemo(
    () => resumirQualidadeComposicao(componentes, trilha),
    [componentes, trilha],
  );
  const relatorioPrecos = useMemo(
    () => gerarRelatorioPrecosPorUf(atual.precosPorUf || {}, UFS_SINAPI),
    [atual.precosPorUf],
  );

  function abrirComposicao(componente) {
    const avaliacao = avaliarComponenteComposicao(componente, trilha);
    const { codigo, basePrecoId } = avaliacao;
    if (!codigo) {
      setAlerta("Não foi possível abrir a composição porque o código da referência não foi informado.");
      return;
    }
    if (avaliacao.ciclo) {
      setAlerta(`Ciclo detectado: a composição ${codigo} já existe no caminho atual e não pode ser aberta novamente.`);
      return;
    }
    setAlerta("");
    setAbaAtiva("analitica");
    setTrilha((niveis) => [...niveis, {
      basePrecoId,
      codigo,
      descricao: componente.descricao || codigo,
      unidade: componente.unidade || "",
      preco: componente.preco || 0,
      precosPorUf: componente.precosPorUf || {},
      tipo: "composicao",
    }]);
  }

  function voltarNivel() {
    setAbaAtiva("analitica");
    setTrilha((niveis) => niveis.slice(0, -1));
  }

  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <section className="orc-modal orc-modal-wide composition-detail-modal" role="dialog" aria-modal="true" aria-labelledby="composition-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>{tituloContexto}</span><h3 id="composition-detail-title">{atual.codigo} · {atual.descricao}</h3></div>
          <button type="button" onClick={fechar} aria-label="Fechar">×</button>
        </header>
        <nav className="composition-trail" aria-label="Caminho da composição">
          {trilha.map((nivel, index) => (
            <span key={`${nivel.basePrecoId}-${nivel.codigo}-${index}`}>
              {index > 0 && <i>›</i>}
              <button type="button" className={index === trilha.length - 1 ? "is-active" : ""} onClick={() => { setAbaAtiva("analitica"); setTrilha((niveis) => niveis.slice(0, index + 1)); }}>{nivel.codigo}</button>
            </span>
          ))}
        </nav>
        <nav className="composition-detail-tabs" role="tablist" aria-label="Visualizações da composição">
          <button type="button" role="tab" aria-selected={abaAtiva === "analitica"} className={abaAtiva === "analitica" ? "is-active" : ""} onClick={() => setAbaAtiva("analitica")}>Composição analítica</button>
          <button type="button" role="tab" aria-selected={abaAtiva === "precos"} className={abaAtiva === "precos" ? "is-active" : ""} onClick={() => setAbaAtiva("precos")}>Relatório de preços</button>
        </nav>
        <div className="composition-tab-content">
          {abaAtiva === "analitica" ? <>
          <div className="composition-detail-summary">
          <div><span>Base</span><strong>{baseAtual?.titulo || atual.baseTitulo || "Base própria"}</strong><small>{baseAtual ? `${baseAtual.uf} · ${baseAtual.referencia} · ${baseAtual.regime}` : "Referência preservada"}</small></div>
          <div><span>Unidade</span><strong>{atual.unidade || "—"}</strong></div>
          <div><span>Preço básico</span><strong>{moeda(atual.preco)}</strong></div>
          <div><span>Componentes</span><strong>{componentes.length}</strong><small>{!componentes.length ? "Sem memória analítica" : qualidade.itensComPendencia ? `${qualidade.itensComPendencia} com pendência` : `Nível ${trilha.length} validado`}</small></div>
          </div>
        {alerta && <div className="composition-quality-alert is-critical" role="alert"><strong>Rastreabilidade interrompida</strong><span>{alerta}</span></div>}
        {!carregando && !componentes.length && <div className="composition-quality-alert is-warning"><strong>Referência analítica incompleta</strong><span>Nenhum componente foi localizado. Esta composição deverá ser revisada antes da consolidação de insumos e suprimentos.</span></div>}
        {!carregando && qualidade.itensComPendencia > 0 && <div className="composition-quality-alert is-warning"><strong>{qualidade.itensComPendencia} componente(s) precisam de revisão</strong><span>{qualidade.ciclos ? `${qualidade.ciclos} ciclo(s) detectado(s). ` : ""}Coeficientes, códigos e preços ausentes estão destacados na tabela.</span></div>}
        <div className="composition-editor-table">
          <table>
            <thead><tr><th>Tipo</th><th>Código / descrição</th><th>Base de origem</th><th>Un.</th><th>Coeficiente</th><th>Preço básico</th><th>Total</th><th /></tr></thead>
            <tbody>
              {componentes.map((componente, index) => {
                const avaliacao = qualidade.avaliacoes[index];
                const { tipo, codigo, preco, coeficiente } = avaliacao;
                const base = basesPrecos.bases.find((item) => item.id === (componente.basePrecoId || atual.basePrecoId));
                const composicao = tipo === "composicao";
                return (
                  <tr
                    key={`${tipo}-${codigo}-${index}`}
                    className={`${composicao ? "is-drillable" : ""} ${avaliacao.valido ? "" : "has-quality-warning"}`}
                    title={avaliacao.pendencias.join(" · ") || (composicao ? "Clique para abrir a composição interna" : undefined)}
                    onClick={composicao ? () => abrirComposicao(componente) : undefined}
                    onKeyDown={composicao ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        abrirComposicao(componente);
                      }
                    } : undefined}
                    tabIndex={composicao ? 0 : undefined}
                    role={composicao ? "button" : undefined}
                    aria-label={composicao ? `Abrir composição ${codigo}` : undefined}
                  >
                    <td><b className={`composition-type ${tipo}`}>{tipo}</b></td>
                    <td><strong>{codigo || "Código ausente"}</strong><small>{componente.descricao}{avaliacao.pendencias.length ? ` · ⚠ ${avaliacao.pendencias.join("; ")}` : ""}</small></td>
                    <td>{componente.baseTitulo || base?.titulo || baseAtual?.titulo || "Base própria"}<small>{componente.baseUf ? `${componente.baseUf} · ${componente.baseReferencia}` : base ? `${base.uf} · ${base.referencia}` : ""}</small></td>
                    <td>{componente.unidade || "—"}</td>
                    <td>{numero(coeficiente)}</td>
                    <td>{preco ? <>{moeda(preco)}{componente.precoSubstituidoSp && <sup title={`Preço de SP utilizado por ausência de preço em ${ufSelecionada}`}>*</sup>}</> : "Sem preço"}</td>
                    <td>{moeda(coeficiente * preco)}</td>
                    <td>{composicao && <button type="button" className={`composition-open-button ${avaliacao.ciclo ? "has-cycle" : ""}`} onClick={(event) => { event.stopPropagation(); abrirComposicao(componente); }} title={avaliacao.ciclo ? "Ciclo detectado no caminho atual" : "Abrir composição interna"}>{avaliacao.ciclo ? "Ciclo ⚠" : "Abrir →"}</button>}</td>
                  </tr>
                );
              })}
              {!carregando && !componentes.length && <tr><td colSpan="8">Nenhum componente analítico foi localizado para esta referência.</td></tr>}
              {carregando && <tr><td colSpan="8">Carregando composição analítica...</td></tr>}
            </tbody>
          </table>
          </div>
          </> : (
            <section className="state-prices-report" role="tabpanel" aria-label="Relatório de preços por estado">
              <div className="state-prices-report-summary">
                <div><span>Estados publicados</span><strong>{relatorioPrecos.publicados}</strong></div>
                <div><span>Referência de SP</span><strong>{relatorioPrecos.referenciasSp}</strong></div>
                <div><span>Sem preço</span><strong>{relatorioPrecos.semPreco}</strong></div>
                <div><span>UF em uso</span><strong>{ufSelecionada}</strong></div>
              </div>
              <div className="state-prices-report-table">
                <table>
                  <thead><tr><th>UF</th><th>Situação</th><th>Preço publicado</th><th>Preço utilizado</th><th>Observação</th></tr></thead>
                  <tbody>{relatorioPrecos.linhas.map((linha) => (
                    <tr key={linha.uf} className={`${linha.uf === ufSelecionada ? "is-selected" : ""} is-${linha.situacao}`}>
                      <td><strong>{linha.uf}</strong></td>
                      <td><span className={`state-price-status is-${linha.situacao}`}>{linha.situacao === "publicado" ? "Publicado" : linha.situacao === "referencia_sp" ? "Referência SP" : "Sem preço"}</span></td>
                      <td>{linha.precoPublicado > 0 ? moeda(linha.precoPublicado) : "—"}</td>
                      <td><strong>{linha.precoUtilizado > 0 ? moeda(linha.precoUtilizado) : "—"}</strong></td>
                      <td><small>{linha.observacao}</small></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          )}
        </div>
        <footer>
          <div className="composition-footer-navigation">
            {componentes.some((item) => item.precoSubstituidoSp) && <small className="composition-fallback-note">* Valor de SP utilizado porque a publicação não possui preço para {ufSelecionada}.</small>}
            {trilha.length > 1 && <button type="button" className="orc-btn orc-btn-ghost composition-back-button" onClick={voltarNivel}>← Voltar ao nível anterior</button>}
          </div>
          <button type="button" className="orc-btn orc-btn-primary" onClick={fechar}>Fechar</button>
        </footer>
      </section>
    </div>
  );
}
