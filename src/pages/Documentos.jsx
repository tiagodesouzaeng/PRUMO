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
  const [documentoId, setDocumentoId] = useState("");
  const [versao, setVersao] = useState({ nomeArquivo: "", sha256: "", storageKey: "" });
  const [vinculo, setVinculo] = useState({ moduleId: "medicoes", entidadeTipo: "medicao", entidadeId: "" });
  const [mensagem, setMensagem] = useState(cliente ? "Carregando documentos…" : "Conecte a API corporativa para usar o GED.");

  async function carregar() {
    if (!cliente) return;
    try {
      const lista = await cliente.listarDocumentos();
      setDocumentos(lista);
      setDocumentoId((atual) => atual || lista[0]?.id || "");
      setMensagem("");
    } catch (error) {
      setMensagem(error.message);
    }
  }

  async function adicionarVersao(event) {
    event.preventDefault();
    if (!cliente || !documentoId) return;
    try {
      await cliente.adicionarVersaoDocumento(documentoId, {
        ...versao, tipoMime: "application/octet-stream", tamanhoBytes: 0,
        metadados: { origem: "registro-assistido" },
      });
      setVersao({ nomeArquivo: "", sha256: "", storageKey: "" });
      await carregar();
    } catch (error) { setMensagem(error.message); }
  }

  async function vincular(event) {
    event.preventDefault();
    if (!cliente || !documentoId) return;
    try {
      await cliente.vincularDocumento(documentoId, vinculo);
      setVinculo((atual) => ({ ...atual, entidadeId: "" }));
      await carregar();
    } catch (error) { setMensagem(error.message); }
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
            {documentos.map((item) => <button type="button" key={item.id} className={`sigiu-document-row ${documentoId === item.id ? "is-selected" : ""}`} onClick={() => setDocumentoId(item.id)}><div><strong>{item.titulo}</strong><span>{item.tipo.replaceAll("_", " ")} · {item.status} · {item.vinculos?.length || 0} vínculos</span></div><div><strong>v{item.versaoAtual}</strong><span>{item.versoes?.[0]?.nomeArquivo || "sem arquivo"}</span></div></button>)}
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
      <div className="sigiu-module-grid sigiu-module-grid--main-side">
        <section className="sigiu-card sigiu-admin-card">
          <header className="sigiu-card-header-row"><div><h2>Registrar versão</h2><p>Informe a referência criada pelo armazenamento corporativo e o hash calculado sobre o arquivo.</p></div></header>
          <form className="sigiu-simple-form" onSubmit={adicionarVersao}>
            <label><span>Documento</span><select value={documentoId} onChange={(e) => setDocumentoId(e.target.value)}>{documentos.map((item) => <option key={item.id} value={item.id}>{item.titulo}</option>)}</select></label>
            <label><span>Nome do arquivo</span><input value={versao.nomeArquivo} onChange={(e) => setVersao((atual) => ({ ...atual, nomeArquivo: e.target.value }))} placeholder="projeto-executivo.pdf" /></label>
            <label><span>SHA-256</span><input value={versao.sha256} onChange={(e) => setVersao((atual) => ({ ...atual, sha256: e.target.value.toLowerCase() }))} maxLength={64} placeholder="64 caracteres hexadecimais" /></label>
            <label><span>Referência segura</span><input value={versao.storageKey} onChange={(e) => setVersao((atual) => ({ ...atual, storageKey: e.target.value }))} placeholder="tenant/documentos/arquivo.pdf" /></label>
            <button className="sigiu-btn sigiu-btn--primary" type="submit" disabled={!documentoId || !versao.nomeArquivo || !/^[0-9a-f]{64}$/.test(versao.sha256) || !versao.storageKey}>Registrar versão</button>
          </form>
        </section>
        <section className="sigiu-card sigiu-admin-card">
          <header className="sigiu-card-header-row"><div><h2>Vincular anexo</h2><p>Associe o documento a uma medição ou a outra entidade técnica sem duplicar o arquivo.</p></div></header>
          <form className="sigiu-simple-form" onSubmit={vincular}>
            <label><span>Módulo</span><select value={vinculo.moduleId} onChange={(e) => setVinculo((atual) => ({ ...atual, moduleId: e.target.value }))}><option value="medicoes">Medições</option><option value="patrimonio">Patrimônio</option><option value="obras">Obras</option><option value="orcamentos">Orçamentos</option><option value="manutencao">Manutenção</option><option value="ppci">PPCI</option></select></label>
            <label><span>Tipo da entidade</span><input value={vinculo.entidadeTipo} onChange={(e) => setVinculo((atual) => ({ ...atual, entidadeTipo: e.target.value }))} /></label>
            <label><span>Identificador da entidade</span><input value={vinculo.entidadeId} onChange={(e) => setVinculo((atual) => ({ ...atual, entidadeId: e.target.value }))} placeholder="ID da medição, obra ou orçamento" /></label>
            <button className="sigiu-btn sigiu-btn--primary" type="submit" disabled={!documentoId || !vinculo.entidadeId.trim()}>Vincular documento</button>
          </form>
        </section>
      </div>
    </section>
  );
}
