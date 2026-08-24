/* =====================================================
   RELEASE........: v8.0 + v8.1 RC1
   ARQUIVO........: src/pages/Administracao.jsx
   DESCRIÇÃO......: Módulo gerencial do SIGIU para governança,
                    fontes de dados, usuários, cadastros mestres,
                    parâmetros, sincronização e auditoria.
===================================================== */

import { useEffect, useMemo, useState } from "react";
import {
  SIGIU_ADMIN_AUDITORIA,
  SIGIU_ADMIN_CADASTROS_MESTRES,
  SIGIU_ADMIN_FONTES_DADOS,
  SIGIU_ADMIN_PARAMETROS_ALERTA,
} from "../config/adminConfig";
import {
  baixarArquivoIntegracao,
  carregarAuditoriaIntegracoes,
  carregarIntegracoesBases,
  registrarAuditoriaIntegracao,
  salvarIntegracoesBases,
} from "../services/integracaoBasesPrecos";
import {
  criarClientePrumo,
  diagnosticarInfraestrutura,
  obterConfiguracaoInfraestrutura,
  obterContextoDesenvolvimento,
  verificarInfraestrutura,
} from "../services/infraestruturaCorporativa";
import {
  DOMINIOS_CORPORATIVOS,
  EMPRESAS_DEMONSTRACAO,
  EQUIPES_DEMONSTRACAO,
} from "../domain/multiempresa";
import {
  criarPacoteMigracao,
  criarPlanoMigracao,
  inventariarDadosLocais,
} from "../services/migracaoCorporativa";
import { carregarOrcamentos } from "../services/orcamentoRepository";
import { listarComposicoesProprias } from "../services/composicoesPropriasRepository";
import { criarManifestoLocalOrcamentos } from "../services/repositorioCorporativo";
import {
  MODULOS_PLATAFORMA,
  PERMISSOES_PADRAO_POR_PERFIL,
  PERMISSOES_PLATAFORMA,
} from "../../shared/platform";
import {
  ROADMAP_PRUMO,
  STATUS_ROADMAP,
  agruparRoadmapPorFase,
} from "../config/roadmapPrumo";

const ABAS_ADMIN = [
  { id: "geral", label: "Visão operacional" },
  { id: "produto", label: "Módulos e produto" },
  { id: "usuarios", label: "Perfis e permissões" },
  { id: "sync", label: "Integrações" },
  { id: "bases-precos", label: "Publicação de bases" },
  { id: "infraestrutura", label: "Operação técnica" },
  { id: "auditoria", label: "Auditoria" },
];

function StatusChip({ status }) {
  const normalizado = String(status || "").toLowerCase();
  let classe = "neutral";

  if (normalizado.includes("ativo") || normalizado.includes("operacional") || normalizado.includes("conclu")) classe = "success";
  if (normalizado.includes("previsto") || normalizado.includes("planejado") || normalizado.includes("aguardando")) classe = "warning";
  if (normalizado.includes("erro") || normalizado.includes("inativo")) classe = "danger";

  return <span className={`sigiu-status-chip sigiu-status-chip--${classe}`}>{status}</span>;
}

function AdminTabButton({ aba, ativa, onClick }) {
  return (
    <button
      type="button"
      className={`sigiu-admin-tab ${ativa ? "is-active" : ""}`}
      onClick={onClick}
    >
      <span>{aba.label}</span>
      {aba.badge && <strong>{aba.badge}</strong>}
    </button>
  );
}

function ConfigResumo() {
  const configuracao = useMemo(() => obterConfiguracaoInfraestrutura(), []);
  const contexto = useMemo(() => obterContextoDesenvolvimento(), []);
  const cliente = useMemo(() => (
    configuracao.apiConfigurada && contexto
      ? criarClientePrumo({ baseUrl: configuracao.apiUrl, obterContexto: () => contexto })
      : null
  ), [configuracao, contexto]);
  const [estado, setEstado] = useState({ produto: null, contexto: null, integracoes: [], trabalhos: [], politica: null, erro: "" });

  async function carregarResumo() {
    if (!cliente) return;
    try {
      const [contextoAtual, produto, integracoes, trabalhos, politica] = await Promise.all([
        cliente.obterContextoCorporativo(), cliente.obterProdutoModular(),
        cliente.listarIntegracoes(), cliente.listarTrabalhos(), cliente.obterPoliticaAuditoria(),
      ]);
      setEstado({ produto, contexto: contextoAtual, integracoes, trabalhos, politica, erro: "" });
    } catch (error) {
      setEstado((atual) => ({ ...atual, erro: error.message }));
    }
  }

  useEffect(() => { carregarResumo(); }, [cliente]);
  const modulos = estado.produto?.modulos || [];
  const habilitados = modulos.filter((item) => item.habilitado).length;
  const capacidades = modulos.reduce((total, item) => total + (item.capacidades?.length || 0), 0);
  const pendencias = [
    !configuracao.autenticacaoConfigurada && "Provedor de identidade ainda não configurado",
    !estado.integracoes.length && "Nenhuma integração corporativa cadastrada",
    modulos.some((item) => item.id !== "visao-geral" && !item.capacidades?.length)
      && "Há módulos operacionais sem capacidades catalogadas",
  ].filter(Boolean);

  return (
    <div className="sigiu-admin-stack">
      {estado.erro && <div className="sigiu-admin-base-notice" role="status">{estado.erro}</div>}
      <section className="sigiu-admin-live-summary" aria-label="Situação administrativa atual">
        <article><span>Módulos habilitados</span><strong>{modulos.length ? `${habilitados}/${modulos.length}` : "—"}</strong><small>catálogo contratado</small></article>
        <article><span>Capacidades catalogadas</span><strong>{capacidades || "—"}</strong><small>funções governadas</small></article>
        <article><span>Integrações</span><strong>{estado.integracoes.length}</strong><small>registradas no PostgreSQL</small></article>
        <article><span>Fila técnica</span><strong>{estado.trabalhos.length}</strong><small>trabalhos rastreáveis</small></article>
      </section>
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Ambiente corporativo</h2>
            <p>Informações carregadas da API e do PostgreSQL para a organização e equipe ativas.</p>
          </div>
          <StatusChip status={cliente ? "Operacional" : "API não conectada"} />
        </header>
        <div className="sigiu-admin-definition-list">
          <div><span>Organização</span><strong>{estado.contexto?.tenantNome || "Aguardando API"}</strong></div>
          <div><span>Equipe</span><strong>{estado.contexto?.teamId || "Sem equipe selecionada"}</strong></div>
          <div><span>Perfil</span><strong>{estado.contexto?.perfilId || "—"}</strong></div>
          <div><span>Recuperação</span><strong>{estado.politica?.ultimoTesteRestauracaoOk ? "Restauração verificada" : "Verificação pendente"}</strong></div>
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Catálogo multimódulo</h2>
            <p>Todos os domínios reutilizam o mesmo núcleo de empresas, equipes, permissões, auditoria e integrações.</p>
          </div>
          <StatusChip status={`${modulos.length || MODULOS_PLATAFORMA.length} módulos`} />
        </header>
        <div className="sigiu-platform-module-grid">
          {(modulos.length ? modulos : MODULOS_PLATAFORMA).map((modulo) => (
            <article key={modulo.id}>
              <span>{String(modulo.ordem).padStart(3, "0")}</span>
              <strong>{modulo.nome}</strong>
              <small>{modulo.capacidades?.length || 0} capacidades · {modulo.habilitado === false ? "suspenso" : "habilitado"}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row"><div><h2>Pendências administrativas reais</h2><p>Somente itens que ainda exigem implementação ou configuração.</p></div><StatusChip status={`${pendencias.length} pendência(s)`} /></header>
        <div className="sigiu-admin-action-list">
          {pendencias.map((item) => <article key={item}><span>!</span><strong>{item}</strong></article>)}
          {!pendencias.length && <p className="sigiu-admin-empty">Nenhuma pendência administrativa identificada.</p>}
        </div>
      </section>
    </div>
  );
}

function InfraestruturaCorporativa({ basesPrecos }) {
  const configuracao = useMemo(() => obterConfiguracaoInfraestrutura(), []);
  const contexto = useMemo(() => obterContextoDesenvolvimento(), []);
  const cliente = useMemo(() => (
    configuracao.apiConfigurada && contexto
      ? criarClientePrumo({
        baseUrl: configuracao.apiUrl,
        obterContexto: () => contexto,
      })
      : null
  ), [configuracao, contexto]);
  const diagnostico = useMemo(
    () => diagnosticarInfraestrutura(configuracao),
    [configuracao],
  );
  const [verificando, setVerificando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [mensagemLote, setMensagemLote] = useState("");
  const [lotes, setLotes] = useState([]);
  const [trabalhos, setTrabalhos] = useState([]);
  const [transicoes, setTransicoes] = useState([]);
  const [prontidao, setProntidao] = useState(null);
  const [piloto, setPiloto] = useState(null);
  const [justificativaPiloto, setJustificativaPiloto] = useState("");
  const [salvandoPiloto, setSalvandoPiloto] = useState(false);
  const [processandoTrabalho, setProcessandoTrabalho] = useState(false);
  const [mensagemGovernanca, setMensagemGovernanca] = useState("");
  const dadosMigracao = useMemo(() => ({
    orcamentos: carregarOrcamentos(),
    composicoesProprias: listarComposicoesProprias(),
    bases: basesPrecos?.bases || [],
  }), [basesPrecos?.bases]);
  const planoMigracao = useMemo(
    () => criarPlanoMigracao(inventariarDadosLocais(dadosMigracao)),
    [dadosMigracao],
  );

  async function carregarLotes() {
    if (!cliente) return;
    try {
      setLotes(await cliente.listarLotesMigracao());
    } catch {
      setLotes([]);
    }
  }

  async function carregarGovernanca() {
    if (!cliente) return;
    try {
      const [fila, estados, estadoProntidao, estadoPiloto] = await Promise.all([
        cliente.listarTrabalhos(),
        cliente.listarTransicoesRepositorio(),
        cliente.obterProntidaoOperacional(),
        cliente.obterEstadoPiloto(),
      ]);
      setTrabalhos(fila);
      setTransicoes(estados);
      setProntidao(estadoProntidao);
      setPiloto(estadoPiloto);
    } catch {
      setTrabalhos([]);
      setTransicoes([]);
      setProntidao(null);
      setPiloto(null);
    }
  }

  useEffect(() => {
    carregarLotes();
    carregarGovernanca();
  }, [cliente]);

  async function testarInfraestrutura() {
    setVerificando(true);
    setResultado(await verificarInfraestrutura(configuracao));
    setVerificando(false);
  }

  async function enviarLote() {
    if (!cliente || !contexto) {
      setMensagemLote("Configure a sessão corporativa local para enviar o lote.");
      return;
    }
    setProcessandoLote(true);
    setMensagemLote("");
    try {
      const pacote = await criarPacoteMigracao({
        contexto,
        dados: dadosMigracao,
        usuarioId: contexto.usuarioId,
      });
      const recebido = await cliente.receberLoteMigracao(pacote);
      const validado = await cliente.validarLoteMigracao(recebido.id);
      setMensagemLote(
        validado.status === "validado"
          ? "Lote recebido e validado. Revise as contagens antes de homologar."
          : `Lote rejeitado: ${(validado.erros || []).join(" · ")}`,
      );
      await carregarLotes();
    } catch (erro) {
      setMensagemLote(erro.message);
    } finally {
      setProcessandoLote(false);
    }
  }

  async function homologarLote(loteId) {
    setProcessandoLote(true);
    setMensagemLote("");
    try {
      await cliente.homologarLoteMigracao(loteId);
      setMensagemLote("Lote homologado no banco corporativo com rastreabilidade.");
      await carregarLotes();
      await carregarGovernanca();
    } catch (erro) {
      setMensagemLote(erro.message);
    } finally {
      setProcessandoLote(false);
    }
  }

  async function testarWorker() {
    if (!cliente) return;
    setProcessandoTrabalho(true);
    setMensagemGovernanca("");
    try {
      await cliente.criarTrabalho(
        { tipo: "sistema.diagnostico", payload: { origem: "administracao" } },
        `diagnostico:${Date.now()}`,
      );
      await new Promise((resolve) => globalThis.setTimeout(resolve, 350));
      await carregarGovernanca();
      setMensagemGovernanca("Worker respondeu e registrou o processamento na fila.");
    } catch (erro) {
      setMensagemGovernanca(erro.message);
    } finally {
      setProcessandoTrabalho(false);
    }
  }

  async function verificarParidadeRepositorio(transicao) {
    setMensagemGovernanca("");
    try {
      const manifesto = await criarManifestoLocalOrcamentos(dadosMigracao.orcamentos);
      const resultadoVerificacao = await cliente.verificarTransicaoRepositorio(transicao.dominioId, manifesto);
      await carregarGovernanca();
      setMensagemGovernanca(
        resultadoVerificacao.verificacao.status === "conforme"
          ? `Paridade comprovada: ${manifesto.total} orçamento(s), sem divergências.`
          : "A promoção foi bloqueada porque existem divergências entre o navegador e o PostgreSQL.",
      );
    } catch (erro) {
      setMensagemGovernanca(erro.message);
    }
  }

  async function alterarModoRepositorio(transicao, modo) {
    setMensagemGovernanca("");
    try {
      const manifestoAtual = modo === "corporativo"
        ? await criarManifestoLocalOrcamentos(dadosMigracao.orcamentos)
        : null;
      await cliente.alterarTransicaoRepositorio(
        transicao.dominioId,
        {
          modo,
          ...(manifestoAtual ? { manifestoHash: manifestoAtual.hash } : {}),
          ...(modo === "hibrido" ? { justificativa: "Retorno administrativo para validação segura." } : {}),
        },
        transicao.versao,
      );
      await carregarGovernanca();
      setMensagemGovernanca(
        modo === "corporativo"
          ? "Banco corporativo ativado como fonte principal. Reabra o módulo para recarregar os dados."
          : `Domínio alterado para o modo ${modo}.`,
      );
    } catch (erro) {
      setMensagemGovernanca(erro.message);
    }
  }

  function editarRequisitoPiloto(itemId, campo, valor) {
    setPiloto((atual) => atual ? {
      ...atual,
      itens: atual.itens.map((item) => item.id === itemId ? { ...item, [campo]: valor } : item),
    } : atual);
  }

  async function salvarRequisitoPiloto(item) {
    if (!cliente) return;
    setSalvandoPiloto(true);
    setMensagemGovernanca("");
    try {
      setPiloto(await cliente.atualizarRequisitoPiloto(item.id, {
        status: item.status,
        evidencia: item.evidencia || "",
        observacao: item.observacao || "",
      }));
      setMensagemGovernanca("Evidência registrada no histórico do piloto.");
    } catch (erro) {
      setMensagemGovernanca(erro.message);
    } finally {
      setSalvandoPiloto(false);
    }
  }

  async function executarDecisaoPiloto(acao) {
    if (!cliente) return;
    setSalvandoPiloto(true);
    setMensagemGovernanca("");
    try {
      setPiloto(await cliente.decidirPiloto({ acao, justificativa: justificativaPiloto }));
      setJustificativaPiloto("");
      setMensagemGovernanca("Decisão do piloto registrada e auditada.");
    } catch (erro) {
      setMensagemGovernanca(erro.message);
    } finally {
      setSalvandoPiloto(false);
    }
  }

  return (
    <div className="sigiu-admin-stack">
      <section className="sigiu-card sigiu-admin-card sigiu-infrastructure-summary">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Fundação corporativa</h2>
            <p>Diagnóstico da transição entre o armazenamento local e a futura plataforma centralizada.</p>
          </div>
          <StatusChip status={configuracao.modo === "corporativo" ? "Modo corporativo" : "Modo local seguro"} />
        </header>
        <div className="sigiu-admin-definition-list">
          <div><span>API do PRUMO</span><strong>{configuracao.apiUrl || "Não configurada"}</strong></div>
          <div><span>Provedor de autenticação</span><strong>{configuracao.autenticacaoUrl || "Não configurado"}</strong></div>
          <div><span>Compatibilidade local</span><strong>Ativa durante a migração</strong></div>
          <div><span>Backlog permanente</span><strong>BACKLOG_PRUMO.md</strong></div>
        </div>
        <footer className="sigiu-admin-card-actions">
          <button
            type="button"
            className="sigiu-btn sigiu-btn--primary"
            disabled={verificando}
            onClick={testarInfraestrutura}
          >
            {verificando ? "Verificando..." : "Verificar infraestrutura"}
          </button>
          {resultado && (
            <span className={`sigiu-infrastructure-result ${resultado.ok ? "is-success" : "is-error"}`} role="status">
              {resultado.mensagem}
              {Number.isFinite(resultado.latenciaMs) ? ` · ${resultado.latenciaMs} ms` : ""}
              {resultado.versao ? ` · ${resultado.versao}` : ""}
            </span>
          )}
        </footer>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Prontidão operacional</h2>
            <p>Leitura consolidada da API, banco, identidade e armazenamento de arquivos.</p>
          </div>
          <StatusChip status={prontidao?.ok
            ? (prontidao?.componentes?.storage?.ok && configuracao.autenticacaoConfigurada ? "Produção pronta" : "Desenvolvimento pronto")
            : cliente ? "Atenção necessária" : "Sessão necessária"} />
        </header>
        <div className="sigiu-admin-definition-list">
          <div><span>API</span><strong>{prontidao?.versao ? `v${prontidao.versao}` : "Aguardando verificação"}</strong></div>
          <div><span>PostgreSQL</span><strong>{prontidao?.componentes?.banco?.ok ? "Disponível" : "Não verificado"}</strong></div>
          <div><span>Identidade</span><strong>{configuracao.autenticacaoConfigurada ? "OIDC configurado" : "Desenvolvimento controlado"}</strong></div>
          <div><span>Storage GED</span><strong>{prontidao?.componentes?.storage?.ok ? "Disponível" : prontidao?.componentes?.storage?.obrigatorio ? "Bloqueador" : "Pendente para produção"}</strong></div>
        </div>
        <footer className="sigiu-admin-security-note">
          A entrada em produção somente é liberada com PostgreSQL, OIDC e storage corporativo ativos; nenhuma credencial é exibida nesta tela.
        </footer>
      </section>

      <section className="sigiu-card sigiu-admin-card sigiu-pilot-readiness">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Prontidão e piloto corporativo</h2>
            <p>Requisitos das Sprints 24 e 25 com evidência por organização e decisão administrativa auditável.</p>
          </div>
          <StatusChip status={piloto ? `${piloto.avaliacao?.progresso || 0}% · ${piloto.status}` : "API corporativa necessária"} />
        </header>
        {piloto ? (
          <>
            <div className="sigiu-audit-summary">
              <article><span>Ambiente corporativo</span><strong>{piloto.avaliacao?.sprint24?.aprovados || 0}/{piloto.avaliacao?.sprint24?.total || 0}</strong></article>
              <article><span>Migração e piloto</span><strong>{piloto.avaliacao?.sprint25?.aprovados || 0}/{piloto.avaliacao?.sprint25?.total || 0}</strong></article>
              <article><span>Bloqueadores</span><strong>{piloto.avaliacao?.bloqueados || 0}</strong></article>
              <article><span>Promoção</span><strong>{piloto.avaliacao?.podePromover ? "Liberada" : "Bloqueada"}</strong></article>
            </div>
            <div className="sigiu-pilot-checklist">
              {piloto.itens.map((item) => (
                <article key={item.id}>
                  <div className="sigiu-pilot-checklist__heading">
                    <div><small>Sprint {item.sprint} · {item.grupo}</small><strong>{item.titulo}</strong></div>
                    <select aria-label={`Status de ${item.titulo}`} value={item.status} onChange={(event) => editarRequisitoPiloto(item.id, "status", event.target.value)}>
                      <option value="pendente">Pendente</option>
                      <option value="em_validacao">Em validação</option>
                      <option value="aprovado">Aprovado</option>
                      <option value="bloqueado">Bloqueado</option>
                    </select>
                  </div>
                  <label><span>Evidência</span><input value={item.evidencia || ""} onChange={(event) => editarRequisitoPiloto(item.id, "evidencia", event.target.value)} placeholder="Relatório, execução, URL ou registro verificável" /></label>
                  <label><span>Observação</span><input value={item.observacao || ""} onChange={(event) => editarRequisitoPiloto(item.id, "observacao", event.target.value)} placeholder="Risco, responsável ou pendência" /></label>
                  <button type="button" className="sigiu-btn sigiu-btn--outline" disabled={salvandoPiloto} onClick={() => salvarRequisitoPiloto(item)}>Registrar evidência</button>
                </article>
              ))}
            </div>
            <footer className="sigiu-pilot-decision">
              <label><span>Justificativa da decisão</span><input value={justificativaPiloto} onChange={(event) => setJustificativaPiloto(event.target.value)} placeholder="Informe a decisão administrativa e sua justificativa" /></label>
              <div className="sigiu-admin-card-actions">
                {piloto.status === "preparacao" && <button type="button" className="sigiu-btn sigiu-btn--primary" disabled={salvandoPiloto} onClick={() => executarDecisaoPiloto("iniciar")}>Iniciar piloto</button>}
                {piloto.status === "em_execucao" && <><button type="button" className="sigiu-btn sigiu-btn--primary" disabled={salvandoPiloto} onClick={() => executarDecisaoPiloto("aprovar")}>Aprovar piloto</button><button type="button" className="sigiu-btn" disabled={salvandoPiloto} onClick={() => executarDecisaoPiloto("suspender")}>Suspender</button></>}
                {piloto.status === "suspenso" && <button type="button" className="sigiu-btn sigiu-btn--primary" disabled={salvandoPiloto} onClick={() => executarDecisaoPiloto("retomar")}>Retomar piloto</button>}
                {piloto.status === "aprovado" && <button type="button" className="sigiu-btn sigiu-btn--primary" disabled={salvandoPiloto} onClick={() => executarDecisaoPiloto("encerrar")}>Encerrar e promover</button>}
              </div>
            </footer>
          </>
        ) : <p className="sigiu-admin-empty">Conecte a API e selecione uma organização para registrar evidências do ambiente e do piloto.</p>}
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Inventário para migração</h2>
            <p>Cada domínio será migrado com validação, rastreabilidade e possibilidade de retorno.</p>
          </div>
          <StatusChip status="Migração assistida" />
        </header>
        <div className="sigiu-infrastructure-grid">
          {diagnostico.map((item) => (
            <article key={item.id}>
              <div><strong>{item.titulo}</strong><StatusChip status={item.status} /></div>
              <p>{item.detalhe}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Plano de migração assistida</h2>
            <p>Ordem, contagens e barreiras previstas antes da publicação no banco corporativo.</p>
          </div>
          <StatusChip status="Processo reversível" />
        </header>
        <div className="sigiu-migration-plan">
          {planoMigracao.map((dominio, indice) => (
            <article key={dominio.dominioId}>
              <span>{indice + 1}</span>
              <div>
                <strong>{dominio.titulo}</strong>
                <small>{dominio.total.toLocaleString("pt-BR")} registros identificados · {dominio.situacao}</small>
              </div>
              <em>{dominio.permiteRetorno ? "Reversível" : "Definitivo"}</em>
            </article>
          ))}
        </div>
        <footer className="sigiu-admin-security-note">
          Cada lote terá hash, chave de idempotência, empresa de destino, responsável e conferência de contagens.
        </footer>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Homologação dos dados locais</h2>
            <p>O envio grava primeiro uma área temporária. A publicação definitiva exige validação e confirmação administrativa.</p>
          </div>
          <StatusChip status={cliente ? "Banco conectado" : "Sessão necessária"} />
        </header>
        <div className="sigiu-migration-plan">
          {lotes.length === 0 && (
            <article>
              <span>0</span>
              <div>
                <strong>Nenhum lote corporativo enviado</strong>
                <small>Os dados locais permanecem preservados e operacionais.</small>
              </div>
              <em>Aguardando</em>
            </article>
          )}
          {lotes.map((lote) => (
            <article key={lote.id}>
              <span>{Object.values(lote.contagens || {}).reduce((soma, total) => soma + Number(total || 0), 0)}</span>
              <div>
                <strong>{String(lote.hash || "").slice(0, 12)}…</strong>
                <small>
                  {Object.entries(lote.contagens || {})
                    .map(([dominio, total]) => `${dominio}: ${total}`)
                    .join(" · ")}
                </small>
              </div>
              {lote.status === "validado" ? (
                <button
                  type="button"
                  className="sigiu-btn sigiu-btn--primary"
                  disabled={processandoLote}
                  onClick={() => homologarLote(lote.id)}
                >
                  Homologar
                </button>
              ) : <em>{lote.status}</em>}
            </article>
          ))}
        </div>
        <footer className="sigiu-admin-card-actions">
          <button
            type="button"
            className="sigiu-btn sigiu-btn--primary"
            disabled={!cliente || processandoLote}
            onClick={enviarLote}
          >
            {processandoLote ? "Processando..." : "Gerar, enviar e validar lote"}
          </button>
          {mensagemLote && <span className="sigiu-infrastructure-result" role="status">{mensagemLote}</span>}
        </footer>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Fila de processamento</h2>
            <p>Importações e cálculos extensos são executados fora da interação principal e permanecem rastreáveis.</p>
          </div>
          <StatusChip status={`${trabalhos.length} trabalho(s)`} />
        </header>
        <div className="sigiu-migration-plan">
          {trabalhos.length === 0 && (
            <article>
              <span>0</span>
              <div>
                <strong>Fila vazia</strong>
                <small>Nenhuma importação ou cálculo está aguardando processamento.</small>
              </div>
              <em>Disponível</em>
            </article>
          )}
          {trabalhos.slice(0, 8).map((trabalho) => (
            <article key={trabalho.id}>
              <span>{Math.round(Number(trabalho.progresso) || 0)}%</span>
              <div>
                <strong>{trabalho.tipo}</strong>
                <small>
                  tentativa {trabalho.tentativas}/{trabalho.maxTentativas}
                  {trabalho.erro?.mensagem ? ` · ${trabalho.erro.mensagem}` : ""}
                </small>
              </div>
              <em>{trabalho.status}</em>
            </article>
          ))}
        </div>
        <footer className="sigiu-admin-card-actions">
          <button
            type="button"
            className="sigiu-btn sigiu-btn--primary"
            disabled={!cliente || processandoTrabalho}
            onClick={testarWorker}
          >
            {processandoTrabalho ? "Testando..." : "Testar worker"}
          </button>
          <button
            type="button"
            className="sigiu-btn"
            disabled={!cliente}
            onClick={carregarGovernanca}
          >
            Atualizar fila
          </button>
        </footer>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Transição dos repositórios</h2>
            <p>O modo híbrido mantém o cache local enquanto confere e sincroniza os registros corporativos.</p>
          </div>
          <StatusChip status="Reversível" />
        </header>
        <div className="sigiu-migration-plan">
          {transicoes.length === 0 && (
            <article>
              <span>—</span>
              <div>
                <strong>Nenhum domínio homologado</strong>
                <small>A transição será habilitada após a homologação de um lote com dados.</small>
              </div>
              <em>Local</em>
            </article>
          )}
          {transicoes.map((transicao) => (
            <article key={transicao.dominioId}>
              <span>↻</span>
              <div>
                <strong>{transicao.dominioId}</strong>
                <small>
                  {transicao.sincronizadoEm
                    ? `sincronizado em ${new Date(transicao.sincronizadoEm).toLocaleString("pt-BR")}`
                    : "aguardando primeira sincronização"}
                </small>
                {transicao.verificacao && (
                  <small>
                    Paridade {transicao.verificacao.status}: {transicao.verificacao.localTotal} local / {transicao.verificacao.corporativoTotal} PostgreSQL
                  </small>
                )}
              </div>
              <div className="sigiu-repository-transition-actions">
                {transicao.modo === "hibrido" ? (
                  <>
                    {transicao.dominioId === "orcamentos" && (
                      <button
                        type="button"
                        className="sigiu-btn"
                        onClick={() => verificarParidadeRepositorio(transicao)}
                      >
                        Verificar paridade
                      </button>
                    )}
                    <button
                      type="button"
                      className="sigiu-btn sigiu-btn--primary"
                      disabled={transicao.dominioId !== "orcamentos" || transicao.verificacao?.status !== "conforme"}
                      onClick={() => alterarModoRepositorio(transicao, "corporativo")}
                    >
                      Ativar corporativo
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="sigiu-btn"
                    onClick={() => alterarModoRepositorio(transicao, "hibrido")}
                  >
                    Voltar ao híbrido
                  </button>
                )}
                <em>{transicao.modo}</em>
              </div>
            </article>
          ))}
        </div>
        {mensagemGovernanca && (
          <footer className="sigiu-infrastructure-result" role="status">
            {mensagemGovernanca}
          </footer>
        )}
      </section>

      <section className="sigiu-card sigiu-admin-card sigiu-admin-card--notice">
        <header>
          <span>✓</span>
          <div>
            <h2>Transição sem perda de dados</h2>
            <p>
              O modo híbrido preserva o cache local e sincroniza o PostgreSQL. A troca para o modo
              corporativo exige paridade comprovada por quantidade, identificadores e hashes nas últimas
              24 horas. O retorno ao híbrido é justificado e auditado, sem excluir o cache local.
            </p>
          </div>
        </header>
      </section>
    </div>
  );
}

function OrganizacoesCorporativas() {
  return (
    <div className="sigiu-admin-stack">
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Empresas e equipes</h2>
            <p>Modelo de propriedade que impedirá o compartilhamento involuntário de dados entre clientes.</p>
          </div>
          <StatusChip status="Contrato 10.3" />
        </header>
        <div className="sigiu-tenant-grid">
          {EMPRESAS_DEMONSTRACAO.map((empresa) => (
            <article key={empresa.id}>
              <div>
                <span>EMPRESA</span>
                <strong>{empresa.nomeFantasia || empresa.nome}</strong>
                <small>{empresa.plano} · {empresa.status}</small>
              </div>
              <ul>
                {EQUIPES_DEMONSTRACAO.filter((equipe) => equipe.tenantId === empresa.id).map((equipe) => (
                  <li key={equipe.id}><b>{equipe.nome}</b><small>{equipe.id}</small></li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <footer className="sigiu-admin-security-note">
          Os registros demonstrativos não representam clientes reais. O cadastro definitivo dependerá da autenticação e da API.
        </footer>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Classificação dos dados</h2>
            <p>Bases públicas podem ser compartilhadas; orçamentos, composições próprias e documentos permanecem privados.</p>
          </div>
        </header>
        <div className="sigiu-corporate-domain-list">
          {DOMINIOS_CORPORATIVOS.map((dominio) => (
            <article key={dominio.id}>
              <div>
                <strong>{dominio.nome}</strong>
                <small>{dominio.estrategia}</small>
              </div>
              <span>{dominio.escopo}</span>
              <em>{dominio.proprietario === "plataforma" ? "Compartilhado" : "Privado"}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card sigiu-admin-card--notice">
        <header>
          <span>◈</span>
          <div>
            <h2>Defesa em profundidade</h2>
            <p>
              A interface informa a empresa ativa, a API valida o vínculo autenticado e o PostgreSQL aplica
              segurança por linha. Arquivos usam caminhos segregados e somente URLs temporárias autorizadas.
            </p>
          </div>
        </header>
      </section>
    </div>
  );
}

function FontesDados() {
  const [fonteSelecionada, setFonteSelecionada] = useState(SIGIU_ADMIN_FONTES_DADOS[0]?.id || "ppci");
  const fonteAtual = useMemo(
    () => SIGIU_ADMIN_FONTES_DADOS.find((fonte) => fonte.id === fonteSelecionada) || SIGIU_ADMIN_FONTES_DADOS[0],
    [fonteSelecionada]
  );

  return (
    <div className="sigiu-admin-split">
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Fontes de dados por módulo</h2>
            <p>Controle visual das APIs, planilhas, status e estratégia de sincronização.</p>
          </div>
          <button type="button" className="sigiu-btn sigiu-btn--outline">Nova fonte</button>
        </header>

        <div className="sigiu-admin-source-list">
          {SIGIU_ADMIN_FONTES_DADOS.map((fonte) => (
            <button
              key={fonte.id}
              type="button"
              className={`sigiu-admin-source-row ${fonteSelecionada === fonte.id ? "is-active" : ""}`}
              onClick={() => setFonteSelecionada(fonte.id)}
            >
              <div>
                <strong>{fonte.modulo}</strong>
                <small>{fonte.tipo}</small>
              </div>
              <StatusChip status={fonte.status} />
            </button>
          ))}
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card sigiu-admin-card--detail">
        <header className="sigiu-card-header-row">
          <div>
            <h2>{fonteAtual.modulo}</h2>
            <p>{fonteAtual.tipo}</p>
          </div>
          <StatusChip status={fonteAtual.status} />
        </header>

        <div className="sigiu-admin-form-grid">
          <label>
            <span>URL da API</span>
            <input className="sigiu-input" value={fonteAtual.url} readOnly />
          </label>
          <label>
            <span>Planilha / base</span>
            <input className="sigiu-input" value={fonteAtual.planilha} readOnly />
          </label>
          <label>
            <span>Sincronização</span>
            <input className="sigiu-input" value={fonteAtual.sincronizacao} readOnly />
          </label>
          <label>
            <span>Cache</span>
            <input className="sigiu-input" value={fonteAtual.cache} readOnly />
          </label>
          <label className="sigiu-admin-form-grid__wide">
            <span>Última validação</span>
            <input className="sigiu-input" value={fonteAtual.ultimaValidacao} readOnly />
          </label>
        </div>

        <footer className="sigiu-admin-card-actions">
          <button type="button" className="sigiu-btn sigiu-btn--primary">Validar conexão</button>
          <button type="button" className="sigiu-btn sigiu-btn--outline">Salvar configuração local</button>
        </footer>
      </section>
    </div>
  );
}

function GerenciarBasesPrecos({ basesPrecos }) {
  const [aviso, setAviso] = useState("");
  const basesAtivas = (basesPrecos?.bases || []).filter((base) => !base.propria);
  const basesArquivadas = basesPrecos?.basesExcluidas || [];

  function notificar(texto) {
    setAviso(texto);
    globalThis.setTimeout(() => setAviso(""), 3200);
  }

  async function arquivar(base) {
    if (!globalThis.confirm(`Arquivar a base ${base.titulo}? Ela ficará indisponível para os usuários, mas poderá ser restaurada.`)) return;
    await basesPrecos.remover(base.id);
    notificar("Base arquivada e preservada para auditoria.");
  }

  async function restaurar(base) {
    await basesPrecos.restaurar(base.id);
    notificar("Base restaurada e disponibilizada.");
  }

  async function excluir(base) {
    if (!globalThis.confirm(`Excluir definitivamente a base ${base.titulo}? Catálogo, composições analíticas e arquivo importado serão removidos. Esta ação não pode ser desfeita.`)) return;
    await basesPrecos.excluirDefinitivamente(base.id);
    notificar("Base excluída definitivamente.");
  }

  return (
    <div className="sigiu-admin-price-bases">
      {aviso && <div className="sigiu-admin-base-notice" role="status">{aviso}</div>}
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Publicação central das bases de preços</h2>
            <p>Administre SINAPI, SICRO, SBC e todas as demais bases oficiais, comerciais ou próprias com versão, competência, UF e auditoria.</p>
          </div>
          <StatusChip status={`${basesAtivas.length} ativas`} />
        </header>
        <div className="sigiu-admin-base-list">
          {basesAtivas.map((base) => (
            <article key={base.id}>
              <span><strong>{base.titulo}</strong><small>{base.fonte} · {base.referencia} · {base.regime} · {Number(base.total || 0).toLocaleString("pt-BR")} itens</small></span>
              <StatusChip status="Ativa" />
              <div><button type="button" className="sigiu-btn sigiu-btn--outline" onClick={() => arquivar(base)}>Arquivar</button><button type="button" className="sigiu-admin-danger-button" onClick={() => excluir(base)}>Excluir definitivamente</button></div>
            </article>
          ))}
          {!basesAtivas.length && <p className="sigiu-admin-empty">Nenhuma base importada ativa.</p>}
        </div>
      </section>
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row"><div><h2>Arquivo de auditoria</h2><p>Bases arquivadas permanecem inacessíveis aos demais usuários.</p></div><StatusChip status={`${basesArquivadas.length} arquivadas`} /></header>
        <div className="sigiu-admin-base-list">
          {basesArquivadas.map((base) => (
            <article key={base.id}>
              <span><strong>{base.titulo}</strong><small>Arquivada em {new Date(base.excluidaEm).toLocaleString("pt-BR")}</small></span>
              <StatusChip status="Inativa" />
              <div><button type="button" className="sigiu-btn sigiu-btn--outline" onClick={() => restaurar(base)}>Restaurar</button><button type="button" className="sigiu-admin-danger-button" onClick={() => excluir(base)}>Excluir definitivamente</button></div>
            </article>
          ))}
          {!basesArquivadas.length && <p className="sigiu-admin-empty">Nenhuma base arquivada.</p>}
        </div>
      </section>
    </div>
  );
}

function UsuariosAcessos() {
  const nomesPerfis = {
    administrador: "Administrador", gestor: "Gestor de Engenharia", orcamentista: "Orçamentista",
    fiscal: "Fiscal", aprovador: "Aprovador", consulta: "Consulta",
  };
  const perfis = Object.entries(PERMISSOES_PADRAO_POR_PERFIL).map(([id, permissoes]) => ({
    id, nome: nomesPerfis[id] || id, permissoes,
    modulos: new Set(PERMISSOES_PLATAFORMA.filter((item) => permissoes.includes(item.id)).map((item) => item.moduloId)).size,
  }));
  const modulos = MODULOS_PLATAFORMA.map((modulo) => ({
    ...modulo,
    permissoes: PERMISSOES_PLATAFORMA.filter((item) => item.moduloId === modulo.id),
  })).filter((modulo) => modulo.permissoes.length);
  return (
    <div className="sigiu-admin-stack">
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Perfis padrão da plataforma</h2>
            <p>Matriz canônica usada pela API, incluindo Patrimônio, Demandas, GED e governança.</p>
          </div>
          <StatusChip status={`${perfis.length} perfis`} />
        </header>
        <div className="sigiu-admin-profile-grid">
          {perfis.map((perfil) => (
            <article key={perfil.id}>
              <strong>{perfil.nome}</strong>
              <small>{perfil.permissoes.length} permissões efetivas</small>
              <span>{perfil.modulos} módulos</span>
            </article>
          ))}
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Permissões por módulo</h2>
            <p>Uma única fonte para frontend, API e contratos administrativos.</p>
          </div>
        </header>
        <div className="sigiu-admin-permission-modules">
          {modulos.map((modulo) => (
            <article key={modulo.id}>
              <header><div><strong>{modulo.nome}</strong><small>{modulo.permissoes.map((item) => item.id).join(" · ")}</small></div><StatusChip status={`${modulo.permissoes.length} ações`} /></header>
              <div>
                {perfis.map((perfil) => {
                  const total = modulo.permissoes.filter((item) => perfil.permissoes.includes(item.id)).length;
                  return <span key={perfil.id} className={total ? "is-allowed" : "is-denied"}>{perfil.nome}: {total}/{modulo.permissoes.length}</span>;
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card sigiu-admin-card--notice">
        <header><span>i</span><div><h2>Cadastro de usuários não simulado</h2><p>Os antigos usuários fictícios foram retirados. Inclusão, bloqueio e vínculo com equipes somente serão liberados quando o provedor OIDC e as rotas administrativas de identidade estiverem implementados.</p></div></header>
      </section>
    </div>
  );
}

function CadastrosMestres() {
  return (
    <section className="sigiu-card sigiu-admin-card">
      <header className="sigiu-card-header-row">
        <div>
          <h2>Cadastros mestres</h2>
          <p>Base comum para PPCI, consumo hídrico, obras, orçamentos e manutenção.</p>
        </div>
        <button type="button" className="sigiu-btn sigiu-btn--outline">Gerenciar cadastros</button>
      </header>
      <div className="sigiu-admin-master-grid">
        {SIGIU_ADMIN_CADASTROS_MESTRES.map((cadastro) => (
          <article key={cadastro.grupo}>
            <div>
              <strong>{cadastro.total}</strong>
              <span>{cadastro.grupo}</span>
            </div>
            <small>{cadastro.itens.join(" · ")}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ParametrosAlertas() {
  return (
    <section className="sigiu-card sigiu-admin-card">
      <header className="sigiu-card-header-row">
        <div>
          <h2>Parâmetros de alertas</h2>
          <p>Regras operacionais previstas para classificação de risco por módulo.</p>
        </div>
      </header>
      <div className="sigiu-admin-parametros-grid">
        {SIGIU_ADMIN_PARAMETROS_ALERTA.map((grupo) => (
          <article key={grupo.modulo}>
            <h3>{grupo.modulo}</h3>
            {grupo.parametros.map((parametro) => (
              <div key={`${grupo.modulo}-${parametro.nome}`}>
                <span>{parametro.nome}</span>
                <strong>{parametro.valor}</strong>
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

function Sincronizacao({ basesPrecos }) {
  const configuracaoCorporativa = useMemo(() => obterConfiguracaoInfraestrutura(), []);
  const contextoCorporativo = useMemo(() => obterContextoDesenvolvimento(), []);
  const clienteCorporativo = useMemo(() => (
    configuracaoCorporativa.apiConfigurada && contextoCorporativo
      ? criarClientePrumo({ baseUrl: configuracaoCorporativa.apiUrl, obterContexto: () => contextoCorporativo })
      : null
  ), [configuracaoCorporativa, contextoCorporativo]);
  const [integracoes, setIntegracoes] = useState(carregarIntegracoesBases);
  const [integracoesCorporativas, setIntegracoesCorporativas] = useState([]);
  const [integracaoId, setIntegracaoId] = useState(integracoes[0]?.id || "sinapi");
  const [auditoria, setAuditoria] = useState(carregarAuditoriaIntegracoes);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const integracao = integracoes.find((item) => item.id === integracaoId) || integracoes[0];

  async function carregarIntegracoesCorporativas() {
    if (!clienteCorporativo) return;
    try { setIntegracoesCorporativas(await clienteCorporativo.listarIntegracoes()); }
    catch (error) { setMensagem(error.message); }
  }

  useEffect(() => { carregarIntegracoesCorporativas(); }, []);

  async function garantirIntegracaoCorporativa(item) {
    if (!clienteCorporativo) return null;
    const existente = integracoesCorporativas.find((registro) => registro.provedor === item.fonte);
    if (existente) return existente;
    const criado = await clienteCorporativo.criarIntegracao({
      nome: item.nome,
      provedor: item.fonte,
      status: item.ativa ? "ativa" : "inativa",
      configuracao: { referencia: item.referencia, uf: item.uf, regime: item.regime, periodicidade: item.periodicidade },
    }, crypto.randomUUID());
    setIntegracoesCorporativas((atuais) => [...atuais, criado]);
    return criado;
  }

  function atualizar(campo, valor) {
    setIntegracoes((atuais) => atuais.map((item) => (
      item.id === integracao.id ? { ...item, [campo]: valor } : item
    )));
  }

  async function salvarConfiguracao() {
    salvarIntegracoesBases(integracoes);
    try {
      const corporativa = await garantirIntegracaoCorporativa(integracao);
      setMensagem(corporativa
        ? "Configuração local preservada e integração registrada no servidor."
        : "Configuração da integração salva neste navegador.");
    } catch (error) { setMensagem(error.message); }
  }

  async function agendarSincronizacao(item) {
    if (!clienteCorporativo) return;
    try {
      await clienteCorporativo.criarTrabalho({ tipo: "integracao.sincronizar", prioridade: 40, maxTentativas: 3, payload: { integracaoId: item.id, direcao: "entrada" } }, crypto.randomUUID());
      setMensagem(`Teste técnico de ${item.nome} enviado ao worker. Nenhum arquivo foi importado por esta ação.`);
      globalThis.setTimeout(carregarIntegracoesCorporativas, 250);
    } catch (error) { setMensagem(error.message); }
  }

  async function importarPublicacao() {
    setProcessando(true);
    setMensagem("");
    let corporativa = null;
    try {
      corporativa = await garantirIntegracaoCorporativa(integracao);
      const arquivo = await baixarArquivoIntegracao(integracao);
      const resultado = await basesPrecos.importar(arquivo, {
        fonte: integracao.fonte,
        referencia: integracao.referencia,
        uf: integracao.uf,
        regime: integracao.regime,
      });
      const atualizadaEm = new Date().toISOString();
      const atualizadas = integracoes.map((item) => (
        item.id === integracao.id
          ? { ...item, ultimaExecucao: atualizadaEm, ultimoStatus: "Importação concluída" }
          : item
      ));
      setIntegracoes(atualizadas);
      salvarIntegracoesBases(atualizadas);
      setAuditoria(registrarAuditoriaIntegracao({
        fonte: integracao.fonte,
        status: "Sucesso",
        detalhe: `${arquivo.name} · ${resultado.base.total.toLocaleString("pt-BR")} referências`,
      }));
      if (corporativa) await clienteCorporativo.registrarExecucaoIntegracao(corporativa.id, { status: "concluida", direcao: "entrada", contagens: { importados: resultado.base.total } });
      setMensagem(`Publicação importada: ${resultado.base.titulo}.`);
    } catch (error) {
      setAuditoria(registrarAuditoriaIntegracao({
        fonte: integracao.fonte,
        status: "Falha",
        detalhe: error.message,
      }));
      if (corporativa) await clienteCorporativo.registrarExecucaoIntegracao(corporativa.id, { status: "falhou", direcao: "entrada", erroSanitizado: error.message }).catch(() => {});
      setMensagem(error.message);
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="sigiu-admin-stack">
      {mensagem && <div className="sigiu-admin-base-notice" role="status">{mensagem}</div>}
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div><h2>Conectores corporativos</h2><p>Configurações persistidas no PostgreSQL. O teste do worker apenas valida a fila; a importação efetiva é executada pelo fluxo assistido abaixo.</p></div>
          <StatusChip status={clienteCorporativo ? `${integracoesCorporativas.length} registradas` : "API não conectada"} />
        </header>
        <div className="sigiu-product-modules">
          {integracoesCorporativas.map((item) => <article key={item.id}><div><strong>{item.nome}</strong><span>{item.provedor} · {item.status} · {item.execucoes?.length || 0} testes/execuções</span></div><button type="button" className="sigiu-btn sigiu-btn--outline" onClick={() => agendarSincronizacao(item)}>Testar worker</button></article>)}
          {clienteCorporativo && !integracoesCorporativas.length && <p className="sigiu-admin-empty">Salve uma configuração abaixo para registrá-la no servidor.</p>}
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Integrações de bases de preços</h2>
            <p>Conecte uma URL direta de publicação e reutilize o importador versionado do PRUMO.</p>
          </div>
          <StatusChip status="Execução assistida" />
        </header>
        <div className="sigiu-integration-layout">
          <nav className="sigiu-integration-source-list" aria-label="Fontes integráveis">
            {integracoes.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === integracao.id ? "is-active" : ""}
                onClick={() => setIntegracaoId(item.id)}
              >
                <span><strong>{item.nome}</strong><small>{item.modo}</small></span>
                <StatusChip status={item.ativa ? "Configurada" : "Pendente"} />
              </button>
            ))}
          </nav>

          <div className="sigiu-integration-form">
            <div className="sigiu-admin-form-grid">
              <label className="sigiu-admin-form-grid__wide">
                <span>URL direta do arquivo ZIP, XLSX, XLS ou CSV</span>
                <input
                  className="sigiu-input"
                  value={integracao.urlArquivo}
                  placeholder="https://fonte-oficial.gov.br/publicacao/base.zip"
                  onChange={(event) => atualizar("urlArquivo", event.target.value)}
                />
              </label>
              <label>
                <span>Referência</span>
                <input
                  className="sigiu-input"
                  type="month"
                  value={integracao.referencia}
                  onChange={(event) => atualizar("referencia", event.target.value)}
                />
              </label>
              <label>
                <span>Estado inicial</span>
                <input
                  className="sigiu-input"
                  value={integracao.uf}
                  maxLength={8}
                  onChange={(event) => atualizar("uf", event.target.value.toUpperCase())}
                />
              </label>
              <label>
                <span>Regime</span>
                <select
                  className="sigiu-input"
                  value={integracao.regime}
                  onChange={(event) => atualizar("regime", event.target.value)}
                >
                  <option value="DESONERADO">Desonerado</option>
                  <option value="NAO_DESONERADO">Não desonerado</option>
                  <option value="PADRAO">Padrão da fonte</option>
                </select>
              </label>
              <label>
                <span>Periodicidade de conferência</span>
                <select
                  className="sigiu-input"
                  value={integracao.periodicidade}
                  onChange={(event) => atualizar("periodicidade", event.target.value)}
                >
                  <option>Mensal</option>
                  <option>Quinzenal</option>
                  <option>Semanal</option>
                  <option>Manual</option>
                </select>
              </label>
              <label className="sigiu-integration-switch">
                <input
                  type="checkbox"
                  checked={integracao.ativa}
                  onChange={(event) => atualizar("ativa", event.target.checked)}
                />
                <span>Manter esta fonte habilitada na agenda de integração</span>
              </label>
            </div>
            <footer className="sigiu-admin-card-actions">
              <button type="button" className="sigiu-btn sigiu-btn--outline" onClick={salvarConfiguracao}>
                Salvar configuração
              </button>
              <button
                type="button"
                className="sigiu-btn sigiu-btn--primary"
                disabled={processando || !integracao.urlArquivo}
                onClick={importarPublicacao}
              >
                {processando ? "Baixando e processando..." : "Baixar e importar agora"}
              </button>
            </footer>
          </div>
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card sigiu-admin-card--notice sigiu-admin-card--sync-note">
        <header>
          <span>↻</span>
          <div>
            <h2>Estratégia recomendada</h2>
            <p>
              A CAIXA publica relatórios mensais em ZIP/XLSX, mas ainda não oferece uma API pública estável para o SINAPI.
              Por isso, esta etapa aceita o endereço direto do arquivo oficial, preserva o hash e usa o mesmo fluxo auditável
              de importação manual. O worker corporativo já pode executar e auditar as rotinas registradas; adaptadores oficiais
              específicos poderão substituir o download assistido sem alterar o contrato do módulo.
            </p>
          </div>
        </header>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div><h2>Auditoria local complementar</h2><p>Últimas tentativas assistidas neste navegador; as execuções corporativas permanecem no PostgreSQL.</p></div>
          <StatusChip status={`${auditoria.length} eventos`} />
        </header>
        <div className="sigiu-admin-audit-list">
          {auditoria.slice(0, 8).map((evento) => (
            <article key={evento.id}>
              <span>{new Date(evento.data).toLocaleString("pt-BR")}</span>
              <div><strong>{evento.fonte} · {evento.status}</strong><small>{evento.detalhe}</small></div>
            </article>
          ))}
          {!auditoria.length && <p className="sigiu-admin-empty">Nenhuma integração executada.</p>}
        </div>
      </section>
    </div>
  );
}

function RoadmapProduto() {
  const fases = agruparRoadmapPorFase();
  const concluidas = ROADMAP_PRUMO.filter((item) => item.status === "concluida").length;
  const atuais = ROADMAP_PRUMO.filter((item) => item.status === "em_andamento").length;
  const planejadas = ROADMAP_PRUMO.filter((item) => item.status === "planejada").length;
  const progresso = Math.round((concluidas / ROADMAP_PRUMO.length) * 100);

  return (
    <section className="sigiu-card sigiu-admin-card sigiu-roadmap-card">
      <header className="sigiu-card-header-row">
        <div>
          <span className="sigiu-page-eyebrow">Evolução do produto</span>
          <h2>Roadmap completo do PRUMO</h2>
          <p>Histórico consolidado das entregas e próximos marcos da plataforma, mantido junto à governança e à auditoria.</p>
        </div>
        <StatusChip status={`${progresso}% concluído`} />
      </header>

      <div className="sigiu-roadmap-summary" aria-label="Resumo do roadmap">
        <article><span>Entregas concluídas</span><strong>{concluidas}</strong></article>
        <article><span>Em andamento</span><strong>{atuais}</strong></article>
        <article><span>Planejadas</span><strong>{planejadas}</strong></article>
        <article><span>Total de marcos</span><strong>{ROADMAP_PRUMO.length}</strong></article>
      </div>

      <div className="sigiu-roadmap-progress" aria-label={`${progresso}% do roadmap concluído`}>
        <i style={{ width: `${progresso}%` }} />
      </div>

      <div className="sigiu-roadmap-phases">
        {fases.map((fase) => (
          <section key={fase.nome} className="sigiu-roadmap-phase">
            <header>
              <h3>{fase.nome}</h3>
              <span>{fase.itens.length} marco(s)</span>
            </header>
            <div className="sigiu-roadmap-timeline">
              {fase.itens.map((item) => {
                const status = STATUS_ROADMAP[item.status];
                return (
                  <article key={item.id} className={`sigiu-roadmap-item ${status.classe}`}>
                    <div className="sigiu-roadmap-marker" aria-hidden="true"><i /></div>
                    <div className="sigiu-roadmap-content">
                      <header>
                        <span>Marco {item.id}</span>
                        <em>{status.rotulo}</em>
                      </header>
                      <h4>{item.tema}</h4>
                      <p>{item.resumo}</p>
                      <div>{item.entregas.map((entrega) => <small key={entrega}>{entrega}</small>)}</div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function Auditoria() {
  const configuracao = useMemo(() => obterConfiguracaoInfraestrutura(), []);
  const contexto = useMemo(() => obterContextoDesenvolvimento(), []);
  const cliente = useMemo(() => (
    configuracao.apiConfigurada && contexto
      ? criarClientePrumo({
        baseUrl: configuracao.apiUrl,
        obterContexto: () => contexto,
      })
      : null
  ), [configuracao, contexto]);
  const [filtros, setFiltros] = useState({ moduleId: "", action: "", actorId: "" });
  const [resultado, setResultado] = useState({ itens: [], total: 0, integridade: null });
  const [politica, setPolitica] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function carregar() {
    if (!cliente) return;
    setCarregando(true);
    setMensagem("");
    try {
      const [eventos, politicaAtual] = await Promise.all([
        cliente.listarAuditoria({ ...filtros, limite: 100 }),
        cliente.obterPoliticaAuditoria(),
      ]);
      setResultado(eventos);
      setPolitica(politicaAtual);
    } catch (erro) {
      setMensagem(erro.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [cliente]);

  async function exportar() {
    if (!cliente) return;
    setMensagem("");
    try {
      const conteudo = await cliente.exportarAuditoria(filtros);
      const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `prumo-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setMensagem("Exportação da auditoria concluída.");
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  async function salvarPolitica(event) {
    event.preventDefault();
    if (!cliente || !politica) return;
    setMensagem("");
    try {
      const atualizada = await cliente.atualizarPoliticaAuditoria({
        retencaoDias: Number(politica.retencaoDias),
        frequenciaBackup: politica.frequenciaBackup,
      });
      setPolitica(atualizada);
      setMensagem("Política de auditoria atualizada e registrada na própria trilha.");
      await carregar();
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  const eventos = cliente ? resultado.itens : SIGIU_ADMIN_AUDITORIA.map((evento, indice) => ({
    id: `local-${indice}`,
    criadoEm: evento.data,
    acao: evento.acao,
    usuarioId: evento.usuario,
    moduleId: "administracao",
    entidadeTipo: "demonstração local",
    entidadeId: "—",
    resultado: "local",
    metadados: { detalhe: evento.detalhe },
  }));

  return (
    <div className="sigiu-admin-stack">
      <RoadmapProduto />
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Auditoria corporativa</h2>
            <p>Trilha imutável por organização, com usuário, módulo, entidade e estados anterior e posterior.</p>
          </div>
          <StatusChip status={cliente ? (resultado.integridade?.ok ? "Integridade verificada" : "Verificação necessária") : "Modo local"} />
        </header>
        <div className="sigiu-audit-summary">
          <article><span>Eventos filtrados</span><strong>{cliente ? resultado.total : eventos.length}</strong></article>
          <article><span>Integridade</span><strong>{resultado.integridade?.ok ? "OK" : cliente ? "Pendente" : "Local"}</strong></article>
          <article><span>Retenção</span><strong>{politica ? `${politica.retencaoDias} dias` : "Não configurada"}</strong></article>
          <article><span>Último backup</span><strong>{politica?.ultimoBackupEm ? new Date(politica.ultimoBackupEm).toLocaleString("pt-BR") : "Pendente"}</strong></article>
        </div>
        <form className="sigiu-audit-filters" onSubmit={(event) => { event.preventDefault(); carregar(); }}>
          <label><span>Módulo</span><select value={filtros.moduleId} onChange={(event) => setFiltros((atual) => ({ ...atual, moduleId: event.target.value }))}><option value="">Todos</option>{MODULOS_PLATAFORMA.map((modulo) => <option key={modulo.id} value={modulo.id}>{modulo.nome}</option>)}</select></label>
          <label><span>Ação contém</span><input value={filtros.action} onChange={(event) => setFiltros((atual) => ({ ...atual, action: event.target.value }))} placeholder="Ex.: orçamento" /></label>
          <label><span>Usuário contém</span><input value={filtros.actorId} onChange={(event) => setFiltros((atual) => ({ ...atual, actorId: event.target.value }))} placeholder="Identificador" /></label>
          <button type="submit" className="sigiu-btn sigiu-btn--primary" disabled={!cliente || carregando}>{carregando ? "Consultando..." : "Consultar"}</button>
          <button type="button" className="sigiu-btn sigiu-btn--outline" disabled={!cliente || !resultado.total} onClick={exportar}>Exportar CSV</button>
        </form>
        {!cliente && <footer className="sigiu-admin-security-note">Configure a API e a identidade de desenvolvimento para consultar a trilha corporativa. Os registros abaixo são apenas a demonstração local anterior.</footer>}
        {mensagem && <div className="sigiu-infrastructure-result" role="status">{mensagem}</div>}
        <div className="sigiu-admin-audit-list sigiu-admin-audit-list--corporate">
          {eventos.map((evento) => (
            <article key={evento.id || `${evento.criadoEm}-${evento.acao}`}>
              <span>{evento.criadoEm ? new Date(evento.criadoEm).toLocaleString("pt-BR") : "—"}</span>
              <div>
                <strong>{evento.acao}</strong>
                <small>{evento.usuarioId} · {evento.moduleId} · {evento.entidadeTipo} {evento.entidadeId}</small>
                {(evento.antes || evento.depois || evento.metadados?.detalhe) && <details><summary>Ver registro</summary><pre>{JSON.stringify({ antes: evento.antes, depois: evento.depois, metadados: evento.metadados }, null, 2)}</pre></details>}
                {evento.hash && <small className="sigiu-audit-hash">#{evento.sequencia} · {evento.hash.slice(0, 16)}…</small>}
              </div>
            </article>
          ))}
          {!eventos.length && <p className="sigiu-admin-empty">Nenhum evento encontrado para os filtros informados.</p>}
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div><h2>Retenção, backup e restauração</h2><p>A política é corporativa; a confirmação só ocorre após execução e verificação no PostgreSQL.</p></div>
          <StatusChip status={politica?.ultimoTesteRestauracaoOk ? "Restauração verificada" : "Teste pendente"} />
        </header>
        <form className="sigiu-audit-policy" onSubmit={salvarPolitica}>
          <label><span>Retenção mínima em dias</span><input type="number" min="365" max="36500" value={politica?.retencaoDias || 2555} onChange={(event) => setPolitica((atual) => ({ ...(atual || {}), retencaoDias: event.target.value }))} /></label>
          <label><span>Frequência de backup</span><select value={politica?.frequenciaBackup || "diario"} onChange={(event) => setPolitica((atual) => ({ ...(atual || {}), frequenciaBackup: event.target.value }))}><option value="diario">Diário</option><option value="semanal">Semanal</option><option value="mensal">Mensal</option></select></label>
          <button type="submit" className="sigiu-btn sigiu-btn--primary" disabled={!cliente || !politica}>Salvar política</button>
        </form>
        <div className="sigiu-admin-definition-list">
          <div><span>Último backup confirmado</span><strong>{politica?.ultimoBackupEm ? new Date(politica.ultimoBackupEm).toLocaleString("pt-BR") : "Pendente"}</strong></div>
          <div><span>Último teste de restauração</span><strong>{politica?.ultimoTesteRestauracaoEm ? new Date(politica.ultimoTesteRestauracaoEm).toLocaleString("pt-BR") : "Pendente"}</strong></div>
        </div>
      </section>
    </div>
  );
}

function ProdutoModular() {
  const configuracao = obterConfiguracaoInfraestrutura();
  const cliente = useMemo(() => configuracao.apiConfigurada ? criarClientePrumo({ baseUrl: configuracao.apiUrl, obterContexto: () => obterContextoDesenvolvimento() }) : null, [configuracao.apiUrl]);
  const [produto, setProduto] = useState(null);
  const [mensagem, setMensagem] = useState(cliente ? "Carregando catálogo modular…" : "Conecte a API corporativa para administrar o produto modular.");
  async function carregar() {
    if (!cliente) return;
    try { setProduto(await cliente.obterProdutoModular()); setMensagem(""); } catch (error) { setMensagem(error.message); }
  }
  useEffect(() => { carregar(); }, []);
  async function mudarPerfil(event) {
    try {
      const perfil = await cliente.atualizarPerfilProduto({ perfil: event.target.value, terminologia: produto.perfil.terminologia || {}, templates: produto.perfil.templates || {} });
      setProduto((atual) => ({ ...atual, perfil }));
    } catch (error) { setMensagem(error.message); }
  }
  function alterarPersonalizacao(grupo, campo, valor) {
    setProduto((atual) => ({
      ...atual,
      perfil: { ...atual.perfil, [grupo]: { ...(atual.perfil[grupo] || {}), [campo]: valor } },
    }));
  }
  async function salvarPersonalizacao() {
    try {
      const perfil = await cliente.atualizarPerfilProduto({ perfil: produto.perfil.perfil, terminologia: produto.perfil.terminologia || {}, templates: produto.perfil.templates || {} });
      setProduto((atual) => ({ ...atual, perfil }));
      setMensagem("Terminologia e modelos iniciais atualizados.");
    } catch (error) { setMensagem(error.message); }
  }
  async function alternarModulo(modulo) {
    try {
      const contrato = await cliente.atualizarContratoModulo(modulo.id, { habilitado: !modulo.habilitado });
      setProduto((atual) => ({ ...atual, modulos: atual.modulos.map((item) => item.id === modulo.id ? { ...item, ...contrato } : item) }));
    } catch (error) { setMensagem(error.message); }
  }
  return (
    <div className="sigiu-admin-grid">
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row"><div><h2>Perfil da organização</h2><p>Ajusta terminologia e modelos sem separar o PRUMO em produtos diferentes.</p></div><StatusChip status={`Catálogo v${produto?.versaoCatalogo || 1}`} /></header>
        <div className="sigiu-simple-form">
          <label className="sigiu-product-profile"><span>Perfil operacional</span><select value={produto?.perfil?.perfil || "publico"} onChange={mudarPerfil} disabled={!produto}><option value="publico">Órgão público</option><option value="federacao">Federação</option><option value="privado">Empresa privada</option><option value="escritorio">Escritório de engenharia/arquitetura</option><option value="facilities">Facilities</option></select></label>
          <label><span>Termo para Site</span><input value={produto?.perfil?.terminologia?.site ?? "Site"} onChange={(event) => alterarPersonalizacao("terminologia", "site", event.target.value)} disabled={!produto} /></label>
          <label><span>Termo para Prédio</span><input value={produto?.perfil?.terminologia?.predio ?? "Prédio"} onChange={(event) => alterarPersonalizacao("terminologia", "predio", event.target.value)} disabled={!produto} /></label>
          <label><span>Modelo documental inicial</span><input value={produto?.perfil?.templates?.documentoTecnico ?? "Documento técnico padrão"} onChange={(event) => alterarPersonalizacao("templates", "documentoTecnico", event.target.value)} disabled={!produto} /></label>
          <button type="button" className="sigiu-btn sigiu-btn--primary" onClick={salvarPersonalizacao} disabled={!produto}>Salvar personalização</button>
        </div>
        {mensagem && <p className="sigiu-empty-inline">{mensagem}</p>}
      </section>
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row"><div><h2>Módulos comercializáveis</h2><p>Disponível, contratado, habilitado e permitido são controles independentes e auditáveis.</p></div></header>
        <div className="sigiu-product-modules">
          {produto?.modulos?.map((modulo) => (
            <article key={modulo.id}>
              <div>
                <strong>{modulo.nome}</strong>
                <span>{modulo.pacote} · {(modulo.capacidades || []).map((item) => item.nome || item.capabilityId).join(" · ") || "capacidades ainda não catalogadas"}</span>
                {!!modulo.dependencias?.length && <small>Depende de: {modulo.dependencias.map((item) => item.nome || item.moduleId || item.dependsOnModuleId).join(", ")}</small>}
              </div>
              <div className="sigiu-product-states"><StatusChip status={modulo.contratado ? "Contratado" : "Não contratado"} /><button type="button" className={`sigiu-toggle ${modulo.habilitado ? "is-on" : ""}`} onClick={() => alternarModulo(modulo)} disabled={!modulo.contratado || modulo.id === "visao-geral"} aria-pressed={modulo.habilitado}>{modulo.habilitado ? "Habilitado" : "Suspenso"}</button></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function renderizarAba(abaAtiva, basesPrecos) {
  switch (abaAtiva) {
    case "infraestrutura":
      return <InfraestruturaCorporativa basesPrecos={basesPrecos} />;
    case "bases-precos":
      return <GerenciarBasesPrecos basesPrecos={basesPrecos} />;
    case "usuarios":
      return <UsuariosAcessos />;
    case "sync":
      return <Sincronizacao basesPrecos={basesPrecos} />;
    case "produto":
      return <ProdutoModular />;
    case "auditoria":
      return <Auditoria />;
    case "geral":
    default:
      return <ConfigResumo />;
  }
}

export default function Administracao({ basesPrecos }) {
  const [abaAtiva, setAbaAtiva] = useState("geral");

  return (
    <section className="sigiu-page sigiu-page-modulo sigiu-page-admin">
      <div className="sigiu-page-heading sigiu-page-heading--modulo">
        <div>
          <span className="sigiu-page-eyebrow">Módulo gerencial</span>
          <h1>Administração</h1>
          <p>
            Centro de governança da plataforma: módulos, perfis, integrações,
            dados corporativos, operação técnica e auditoria.
          </p>
        </div>
        <div className="sigiu-page-heading__meta sigiu-page-heading__meta--admin">
          <strong>Governança</strong>
          <span>plataforma integrada</span>
        </div>
      </div>

      <nav className="sigiu-admin-tabs" aria-label="Abas da Administração PRUMO">
        {ABAS_ADMIN.map((aba) => (
          <AdminTabButton
            key={aba.id}
            aba={aba}
            ativa={abaAtiva === aba.id}
            onClick={() => setAbaAtiva(aba.id)}
          />
        ))}
      </nav>

      <div className="sigiu-admin-panel">
        {renderizarAba(abaAtiva, basesPrecos)}
      </div>
    </section>
  );
}
