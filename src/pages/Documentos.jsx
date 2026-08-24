import { useEffect, useMemo, useState } from "react";
import { criarClientePrumo, obterConfiguracaoInfraestrutura, obterContextoDesenvolvimento } from "../services/infraestruturaCorporativa";
import { TIPOS_ENTIDADE_DOCUMENTAL } from "../../shared/documentGovernance";

function criarCliente() {
  const config = obterConfiguracaoInfraestrutura();
  if (!config.apiConfigurada) return null;
  return criarClientePrumo({ baseUrl: config.apiUrl, obterContexto: () => obterContextoDesenvolvimento() });
}

export default function Documentos({ contextoInicial = null }) {
  const cliente = useMemo(criarCliente, []);
  const [documentos, setDocumentos] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [titulo, setTitulo] = useState("");
  const [documentoId, setDocumentoId] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [origem, setOrigem] = useState(contextoInicial || { moduleId: "planejamento", entidadeTipo: "solicitacao", entidadeId: "" });
  const [vinculo, setVinculo] = useState({ moduleId: "obras", entidadeTipo: "obra", entidadeId: "" });
  const [busca, setBusca] = useState("");
  const [mensagem, setMensagem] = useState(cliente ? "Carregando documentos…" : "Conecte a API corporativa para usar o GED.");

  async function carregar() {
    if (!cliente) return;
    try {
      const [lista, catalogo] = await Promise.all([cliente.listarDocumentos(), cliente.listarEntidadesDocumentais()]);
      setDocumentos(lista);
      setEntidades(catalogo);
      setOrigem((atual) => ({ ...atual, entidadeId: atual.entidadeId || catalogo.find((e) => e.moduleId===atual.moduleId&&e.entidadeTipo===atual.entidadeTipo)?.id || "" }));
      setVinculo((atual) => ({ ...atual, entidadeId: atual.entidadeId || catalogo.find((e) => e.moduleId===atual.moduleId&&e.entidadeTipo===atual.entidadeTipo)?.id || "" }));
      const relacionado = contextoInicial && lista.find((documento) => documento.vinculos?.some((item) => item.moduleId===contextoInicial.moduleId&&item.entidadeTipo===contextoInicial.entidadeTipo&&item.entidadeId===contextoInicial.entidadeId));
      setDocumentoId((atual) => relacionado?.id || atual || lista[0]?.id || "");
      setMensagem("");
    } catch (error) {
      setMensagem(error.message);
    }
  }

  async function adicionarVersao(event) {
    event.preventDefault();
    if (!cliente || !documentoId || !arquivo) return;
    const formulario = event.currentTarget;
    setEnviando(true);
    try {
      const hashBuffer = await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer());
      const sha256 = [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const upload = await cliente.solicitarUploadDocumento(documentoId, {
        nomeArquivo: arquivo.name,
        tipoMime: arquivo.type || "application/octet-stream",
        tamanhoBytes: arquivo.size,
        sha256,
      });
      const respostaUpload = await fetch(upload.url, {
        method: upload.metodo || "PUT",
        headers: upload.headers || {},
        body: arquivo,
      });
      if (!respostaUpload.ok) throw new Error("O armazenamento não confirmou o envio do arquivo.");
      await cliente.adicionarVersaoDocumento(documentoId, {
        nomeArquivo: arquivo.name,
        tipoMime: arquivo.type || "application/octet-stream",
        tamanhoBytes: arquivo.size,
        sha256,
        storageKey: upload.storageKey,
        metadados: { origem: "upload-corporativo" },
      });
      setArquivo(null);
      formulario.reset();
      setMensagem("Arquivo enviado e versão registrada com integridade SHA-256.");
      await carregar();
    } catch (error) { setMensagem(error.message); }
    finally { setEnviando(false); }
  }

  async function baixarVersao(numero) {
    if (!cliente || !documentoId) return;
    try {
      const download = await cliente.solicitarDownloadDocumento(documentoId, numero);
      const link = document.createElement("a");
      link.href = download.url;
      link.rel = "noopener";
      link.click();
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
      await cliente.criarDocumento({ titulo: titulo.trim(), tipo: "documento_tecnico", metadados: { origem: "ged-prumo" }, vinculo: origem }, crypto.randomUUID());
      setTitulo("");
      await carregar();
    } catch (error) {
      setMensagem(error.message);
    }
  }

  async function decidir(acao) {
    const documento=documentos.find((item)=>item.id===documentoId); if(!documento)return;
    try { await cliente.decidirDocumento(documento.id,{acao},documento.versao); setMensagem("Situação documental atualizada."); await carregar(); }
    catch(error){setMensagem(error.message);}
  }

  function alterarTipo(setter, chave) {
    const [moduleId,entidadeTipo]=chave.split(":");
    setter({moduleId,entidadeTipo,entidadeId:entidades.find((e)=>e.moduleId===moduleId&&e.entidadeTipo===entidadeTipo)?.id||""});
  }

  const documentoAtual=documentos.find((item)=>item.id===documentoId);
  const documentosVisiveis=documentos.filter((item)=>`${item.titulo} ${item.tipo} ${item.status}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const entidadesDaOrigem=entidades.filter((e)=>e.moduleId===origem.moduleId&&e.entidadeTipo===origem.entidadeTipo);
  const entidadesDoVinculo=entidades.filter((e)=>e.moduleId===vinculo.moduleId&&e.entidadeTipo===vinculo.entidadeTipo);

  return (
    <section className="sigiu-page sigiu-page-modulo">
      <div className="sigiu-page-heading sigiu-page-heading--modulo">
        <div><span className="sigiu-page-eyebrow">Gestão documental</span><h1>Documentos e GED</h1><p>Documentos técnicos com versões, hash de integridade, responsável e vínculos aos módulos.</p></div>
        <div className="sigiu-page-heading__meta"><strong>GED</strong><span>gestão documental</span></div>
      </div>
      <div className="sigiu-module-kpis">
        <article className="sigiu-module-kpi sigiu-module-kpi--primary"><span>▣</span><small>Documentos</small><strong>{documentos.length}</strong><em>no acervo</em></article>
        <article className="sigiu-module-kpi sigiu-module-kpi--success"><span>✓</span><small>Integridade</small><strong>SHA-256</strong><em>por versão</em></article>
        <article className="sigiu-module-kpi sigiu-module-kpi--info"><span>↻</span><small>Histórico</small><strong>Imutável</strong><em>versões preservadas</em></article>
      </div>
      {contextoInicial && <div className="sigiu-context-scope-notice">GED aberto no contexto de <strong>{TIPOS_ENTIDADE_DOCUMENTAL.find((item)=>item.moduleId===contextoInicial.moduleId&&item.entidadeTipo===contextoInicial.entidadeTipo)?.rotulo || contextoInicial.entidadeTipo}</strong>. Novos documentos já serão vinculados a este registro.</div>}
      <div className="sigiu-module-grid sigiu-module-grid--main-side">
        <section className="sigiu-card sigiu-admin-card">
          <header className="sigiu-card-header-row"><div><h2>Acervo técnico</h2><p>O arquivo binário permanece no armazenamento seguro; o PRUMO registra sua referência e integridade.</p></div></header>
          {mensagem && <p className="sigiu-empty-inline">{mensagem}</p>}
          <label className="sigiu-document-search"><span>Localizar no acervo</span><input value={busca} onChange={(e)=>setBusca(e.target.value)} placeholder="Título, tipo ou situação" /></label>
          <div className="sigiu-document-list">
            {documentosVisiveis.map((item) => <button type="button" key={item.id} className={`sigiu-document-row ${documentoId === item.id ? "is-selected" : ""}`} onClick={() => setDocumentoId(item.id)}><div><strong>{item.titulo}</strong><span>{item.tipo.replaceAll("_", " ")} · {item.status.replaceAll("_"," ")} · {item.vinculos?.length || 0} vínculos</span></div><div><strong>v{item.versaoAtual}</strong><span>{item.versoes?.[0]?.nomeArquivo || "sem arquivo"}</span></div></button>)}
            {!mensagem && !documentos.length && <p className="sigiu-empty-inline">Nenhum documento cadastrado.</p>}
          </div>
        </section>
        <section className="sigiu-card sigiu-admin-card">
          <header className="sigiu-card-header-row"><div><h2>Novo documento</h2><p>Todo documento nasce vinculado ao registro que justifica sua existência.</p></div></header>
          <form className="sigiu-simple-form" onSubmit={criar}>
            <label><span>Título</span><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Projeto executivo – Bloco A" /></label>
            <label><span>Origem</span><select value={`${origem.moduleId}:${origem.entidadeTipo}`} onChange={(e)=>alterarTipo(setOrigem,e.target.value)}>{TIPOS_ENTIDADE_DOCUMENTAL.map((t)=><option key={`${t.moduleId}:${t.entidadeTipo}`} value={`${t.moduleId}:${t.entidadeTipo}`}>{t.rotulo}</option>)}</select></label>
            <label><span>Registro relacionado</span><select value={origem.entidadeId} onChange={(e)=>setOrigem((a)=>({...a,entidadeId:e.target.value}))}><option value="">Selecione</option>{entidadesDaOrigem.map((e)=><option key={e.id} value={e.id}>{e.rotulo}</option>)}</select></label>
            <button className="sigiu-btn sigiu-btn--primary" type="submit" disabled={!cliente || titulo.trim().length < 2 || !origem.entidadeId}>Criar documento vinculado</button>
          </form>
          {documentoAtual&&<div className="sigiu-document-workflow"><strong>Fluxo de aprovação</strong><span>{documentoAtual.status.replaceAll("_"," ")} · controle {documentoAtual.versao}</span><div>{documentoAtual.status==="rascunho"&&<button className="sigiu-btn sigiu-btn--outline" disabled={!documentoAtual.versaoAtual} onClick={()=>decidir("submeter")}>Submeter à revisão</button>}{documentoAtual.status==="em_revisao"&&<><button className="sigiu-btn sigiu-btn--outline" onClick={()=>decidir("devolver")}>Devolver</button><button className="sigiu-btn sigiu-btn--primary" onClick={()=>decidir("aprovar")}>Aprovar</button></>}{documentoAtual.status==="aprovado"&&<button className="sigiu-btn sigiu-btn--outline" onClick={()=>decidir("arquivar")}>Arquivar</button>}</div></div>}
        </section>
      </div>
      <div className="sigiu-module-grid sigiu-module-grid--main-side">
        <section className="sigiu-card sigiu-admin-card">
          <header className="sigiu-card-header-row"><div><h2>Enviar nova versão</h2><p>O PRUMO calcula o hash, envia o arquivo ao storage seguro e registra a versão automaticamente.</p></div></header>
          <form className="sigiu-simple-form" onSubmit={adicionarVersao}>
            <label><span>Documento</span><select value={documentoId} onChange={(e) => setDocumentoId(e.target.value)}>{documentos.map((item) => <option key={item.id} value={item.id}>{item.titulo}</option>)}</select></label>
            <label><span>Arquivo</span><input type="file" onChange={(e) => setArquivo(e.target.files?.[0] || null)} /></label>
            {arquivo && <small>{arquivo.name} · {(arquivo.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB</small>}
            <button className="sigiu-btn sigiu-btn--primary" type="submit" disabled={!documentoId || !arquivo || enviando}>{enviando ? "Enviando..." : "Enviar e registrar versão"}</button>
          </form>
          {!!documentos.find((item) => item.id === documentoId)?.versoes?.length && (
            <div className="sigiu-document-versions">
              {documentos.find((item) => item.id === documentoId).versoes.map((item) => (
                <button type="button" className="sigiu-btn sigiu-btn--outline" key={item.numero} onClick={() => baixarVersao(item.numero)}>
                  Baixar v{item.numero} · {item.nomeArquivo}
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="sigiu-card sigiu-admin-card">
          <header className="sigiu-card-header-row"><div><h2>Vincular anexo</h2><p>Associe o documento a uma medição ou a outra entidade técnica sem duplicar o arquivo.</p></div></header>
          <form className="sigiu-simple-form" onSubmit={vincular}>
            <label><span>Tipo de registro</span><select value={`${vinculo.moduleId}:${vinculo.entidadeTipo}`} onChange={(e)=>alterarTipo(setVinculo,e.target.value)}>{TIPOS_ENTIDADE_DOCUMENTAL.map((t)=><option key={`${t.moduleId}:${t.entidadeTipo}`} value={`${t.moduleId}:${t.entidadeTipo}`}>{t.rotulo}</option>)}</select></label>
            <label><span>Registro</span><select value={vinculo.entidadeId} onChange={(e)=>setVinculo((a)=>({...a,entidadeId:e.target.value}))}><option value="">Selecione</option>{entidadesDoVinculo.map((e)=><option key={e.id} value={e.id}>{e.rotulo}</option>)}</select></label>
            <button className="sigiu-btn sigiu-btn--primary" type="submit" disabled={!documentoId || !vinculo.entidadeId.trim()}>Vincular documento</button>
          </form>
          {documentoAtual?.vinculos?.length>0&&<div className="sigiu-document-links">{documentoAtual.vinculos.map((v)=><span key={`${v.moduleId}:${v.entidadeTipo}:${v.entidadeId}`}><b>{v.principal?"Origem":"Relação"}</b> · {TIPOS_ENTIDADE_DOCUMENTAL.find((t)=>t.moduleId===v.moduleId&&t.entidadeTipo===v.entidadeTipo)?.rotulo||v.entidadeTipo}</span>)}</div>}
        </section>
      </div>
    </section>
  );
}
