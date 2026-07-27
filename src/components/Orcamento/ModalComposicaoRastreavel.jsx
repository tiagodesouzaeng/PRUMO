import { useEffect, useMemo, useState } from "react";

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
}) {
  const [trilha, setTrilha] = useState([referencia]);
  const [componentes, setComponentes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const atual = trilha.at(-1);
  const baseAtual = useMemo(
    () => basesPrecos.bases.find((base) => base.id === atual.basePrecoId),
    [basesPrecos.bases, atual.basePrecoId],
  );

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    basesPrecos.carregarItensComposicao(atual.basePrecoId, atual.codigo)
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
  }, [atual.basePrecoId, atual.codigo]);

  function abrirComposicao(componente) {
    const codigo = componente.referenciaCodigo || componente.itemCodigo;
    const basePrecoId = componente.basePrecoId || atual.basePrecoId;
    if (!codigo || trilha.some((nivel) => (
      nivel.codigo === codigo && nivel.basePrecoId === basePrecoId
    ))) return;
    setTrilha((niveis) => [...niveis, {
      basePrecoId,
      codigo,
      descricao: componente.descricao || codigo,
      unidade: componente.unidade || "",
      preco: componente.preco || 0,
    }]);
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
              <button type="button" className={index === trilha.length - 1 ? "is-active" : ""} onClick={() => setTrilha((niveis) => niveis.slice(0, index + 1))}>{nivel.codigo}</button>
            </span>
          ))}
        </nav>
        <div className="composition-detail-summary">
          <div><span>Base</span><strong>{baseAtual?.titulo || atual.baseTitulo || "Base própria"}</strong><small>{baseAtual ? `${baseAtual.uf} · ${baseAtual.referencia} · ${baseAtual.regime}` : "Referência preservada"}</small></div>
          <div><span>Unidade</span><strong>{atual.unidade || "—"}</strong></div>
          <div><span>Preço básico</span><strong>{moeda(atual.preco)}</strong></div>
          <div><span>Componentes</span><strong>{componentes.length}</strong><small>Nível {trilha.length}</small></div>
        </div>
        <div className="composition-editor-table">
          <table>
            <thead><tr><th>Tipo</th><th>Código / descrição</th><th>Base de origem</th><th>Un.</th><th>Coeficiente</th><th>Preço básico</th><th>Total</th><th /></tr></thead>
            <tbody>
              {componentes.map((componente, index) => {
                const tipo = componente.referenciaTipo || componente.itemTipo;
                const codigo = componente.referenciaCodigo || componente.itemCodigo;
                const preco = Number(componente.preco) || 0;
                const coeficiente = Number(componente.coeficiente) || 0;
                const base = basesPrecos.bases.find((item) => item.id === (componente.basePrecoId || atual.basePrecoId));
                const composicao = tipo === "composicao";
                return (
                  <tr key={`${tipo}-${codigo}-${index}`} className={composicao ? "is-drillable" : ""}>
                    <td><b className={`composition-type ${tipo}`}>{tipo}</b></td>
                    <td><strong>{codigo}</strong><small>{componente.descricao}</small></td>
                    <td>{componente.baseTitulo || base?.titulo || baseAtual?.titulo || "Base própria"}<small>{componente.baseUf ? `${componente.baseUf} · ${componente.baseReferencia}` : base ? `${base.uf} · ${base.referencia}` : ""}</small></td>
                    <td>{componente.unidade || "—"}</td>
                    <td>{numero(coeficiente)}</td>
                    <td>{preco ? moeda(preco) : "Sem preço"}</td>
                    <td>{moeda(coeficiente * preco)}</td>
                    <td>{composicao && <button type="button" className="composition-open-button" onClick={() => abrirComposicao(componente)} title="Abrir composição interna">Abrir →</button>}</td>
                  </tr>
                );
              })}
              {!carregando && !componentes.length && <tr><td colSpan="8">Nenhum componente analítico foi localizado para esta referência.</td></tr>}
              {carregando && <tr><td colSpan="8">Carregando composição analítica...</td></tr>}
            </tbody>
          </table>
        </div>
        <footer>
          {trilha.length > 1 && <button type="button" className="orc-btn orc-btn-ghost" onClick={() => setTrilha((niveis) => niveis.slice(0, -1))}>← Voltar um nível</button>}
          <button type="button" className="orc-btn orc-btn-primary" onClick={fechar}>Fechar</button>
        </footer>
      </section>
    </div>
  );
}
