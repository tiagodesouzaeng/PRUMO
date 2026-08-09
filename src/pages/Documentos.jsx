import { useEffect, useMemo, useState } from "react";
import { criarClientePrumo, obterConfiguracaoInfraestrutura, obterContextoDesenvolvimento } from "../services/infraestruturaCorporativa";

function criarCliente() {
  const config = obterConfiguracaoInfraestrutura();
  if (!config.apiConfigurada) return null;
  return criarClientePrumo({ baseUrl: config.apiUrl, obterContexto: () => obterContextoDesenvolvimento() });
}

export default function Documentos() {
  const cliente = useMemo(criarCliente, []);
  const [documentos, setDocumentos] = useState([]);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState(cliente ? "Carregando documentos…" : "Conecte a API corporativa para usar o GED.");

  async function carregar() {
    if (!cliente) return;
    try {
      setDocumentos(await cliente.listarDocumentos());
      setMensagem("");
    } catch (error) {
      setMensagem(error.message);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function criar(event) {
    event.preventDefault();
    if (!cliente || titulo.trim().length < 2) return;
    try {
      await cliente.criarDocumento({ titulo: titulo.trim(), tipo: "documento_tecnico", metadados: { origem: "ged-prumo" } }, crypto.randomUUID());
      setTitulo("");
      await carregar();
    } catch (error) {
      setMensagem(error.message);
    }
  }

  return (
    <section className="sigiu-page sigiu-page-modulo">
      <div className="sigiu-page-heading sigiu-page-heading--modulo">
        <div><span className="sigiu-page-eyebrow">Gestão documental</span><h1>Documentos e GED</h1><p>Documentos técnicos com versões, hash de integridade, responsável e vínculos aos módulos.</p></div>
        <div className="sigiu-page-heading__meta"><strong>10.5</strong><span>fundação corporativa</span></div>
      </div>
      <div className="sigiu-module-kpis">
        <article className="sigiu-module-kpi sigiu-module-kpi--primary"><span>▣</span><small>Documentos</small><strong>{documentos.length}</strong><em>no acervo</em></article>
        <article className="sigiu-module-kpi sigiu-module-kpi--success"><span>✓</span><small>Integridade</small><strong>SHA-256</strong><em>por versão</em></article>
        <article className="sigiu-module-kpi sigiu-module-kpi--info"><span>↻</span><small>Histórico</small><strong>Imutável</strong><em>versões preservadas</em></article>
      </div>
      <div className="sigiu-module-grid sigiu-module-grid--main-side">
        <section className="sigiu-card sigiu-admin-card">
          <header className="sigiu-card-header-row"><div><h2>Acervo técnico</h2><p>O arquivo binário permanece no armazenamento seguro; o PRUMO registra sua referência e integridade.</p></div></header>
          {mensagem && <p className="sigiu-empty-inline">{mensagem}</p>}
          <div className="sigiu-document-list">
            {documentos.map((item) => <article key={item.id} className="sigiu-document-row"><div><strong>{item.titulo}</strong><span>{item.tipo.replaceAll("_", " ")} · {item.status}</span></div><div><strong>v{item.versaoAtual}</strong><span>{item.versoes?.[0]?.nomeArquivo || "sem arquivo"}</span></div></article>)}
            {!mensagem && !documentos.length && <p className="sigiu-empty-inline">Nenhum documento cadastrado.</p>}
          </div>
        </section>
        <section className="sigiu-card sigiu-admin-card">
          <header className="sigiu-card-header-row"><div><h2>Novo documento</h2><p>Crie o registro antes de vincular versões e anexos.</p></div></header>
          <form className="sigiu-simple-form" onSubmit={criar}>
            <label><span>Título</span><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Projeto executivo – Bloco A" /></label>
            <button className="sigiu-btn sigiu-btn--primary" type="submit" disabled={!cliente || titulo.trim().length < 2}>Criar documento</button>
          </form>
        </section>
      </div>
    </section>
  );
}
