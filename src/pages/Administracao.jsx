/* =====================================================
   RELEASE........: v8.0 + v8.1 RC1
   ARQUIVO........: src/pages/Administracao.jsx
   DESCRIÇÃO......: Módulo gerencial do SIGIU para governança,
                    fontes de dados, usuários, cadastros mestres,
                    parâmetros, sincronização e auditoria.
===================================================== */

import { useMemo, useState } from "react";
import {
  SIGIU_ADMIN_AUDITORIA,
  SIGIU_ADMIN_CADASTROS_MESTRES,
  SIGIU_ADMIN_CONFIG_GERAL,
  SIGIU_ADMIN_FONTES_DADOS,
  SIGIU_ADMIN_PARAMETROS_ALERTA,
  SIGIU_ADMIN_PERFIS,
  SIGIU_ADMIN_SYNC_STATUS,
  SIGIU_ADMIN_USUARIOS,
} from "../config/adminConfig";

const ABAS_ADMIN = [
  { id: "geral", label: "Geral", badge: "8.0" },
  { id: "fontes", label: "Fontes de dados", badge: "4" },
  { id: "bases-precos", label: "Bases de preços", badge: "ADM" },
  { id: "usuarios", label: "Usuários e acessos", badge: "3" },
  { id: "cadastros", label: "Cadastros mestres", badge: "4" },
  { id: "parametros", label: "Parâmetros", badge: "3" },
  { id: "sync", label: "Sincronização", badge: "8.1" },
  { id: "auditoria", label: "Auditoria", badge: "log" },
];

function StatusChip({ status }) {
  const normalizado = String(status || "").toLowerCase();
  let classe = "neutral";

  if (normalizado.includes("ativo") || normalizado.includes("operacional")) classe = "success";
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
      <strong>{aba.badge}</strong>
    </button>
  );
}

function ConfigResumo() {
  return (
    <div className="sigiu-admin-grid sigiu-admin-grid--overview">
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Governança do SIGIU</h2>
            <p>Base administrativa para reduzir configurações fixas no código.</p>
          </div>
        </header>
        <div className="sigiu-admin-definition-list">
          <div><span>Versão base</span><strong>{SIGIU_ADMIN_CONFIG_GERAL.versaoBase}</strong></div>
          <div><span>Ambiente</span><strong>{SIGIU_ADMIN_CONFIG_GERAL.ambiente}</strong></div>
          <div><span>Autenticação</span><strong>{SIGIU_ADMIN_CONFIG_GERAL.autenticacao}</strong></div>
          <div><span>Sincronização incremental</span><strong>{SIGIU_ADMIN_CONFIG_GERAL.sincronizacaoIncremental}</strong></div>
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card sigiu-admin-card--notice">
        <header>
          <span>⚠</span>
          <div>
            <h2>Nota técnica</h2>
            <p>
              Usuários, senhas e permissões reais não devem ser armazenados em React, localStorage ou planilha.
              Esta sprint cria a estrutura gerencial. A autenticação segura deve ser feita em backend/serviço próprio.
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
            <h2>Governança das bases de preços</h2>
            <p>Arquive, restaure ou exclua unitariamente publicações importadas.</p>
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
  return (
    <div className="sigiu-admin-stack">
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Usuários</h2>
            <p>Estrutura inicial de usuários e perfis de acesso para o futuro controle seguro.</p>
          </div>
          <button type="button" className="sigiu-btn sigiu-btn--outline">Novo usuário</button>
        </header>
        <div className="sigiu-admin-table sigiu-admin-table--usuarios">
          {SIGIU_ADMIN_USUARIOS.map((usuario) => (
            <article key={usuario.id}>
              <div>
                <strong>{usuario.nome}</strong>
                <small>{usuario.email}</small>
              </div>
              <span>{usuario.perfil}</span>
              <span>{usuario.unidade}</span>
              <small>{usuario.modulos.join(", ")}</small>
              <StatusChip status={usuario.status} />
            </article>
          ))}
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Perfis de acesso</h2>
            <p>Níveis previstos para governança por módulo.</p>
          </div>
        </header>
        <div className="sigiu-admin-profile-grid">
          {SIGIU_ADMIN_PERFIS.map((perfil) => (
            <article key={perfil.id}>
              <strong>{perfil.nome}</strong>
              <small>{perfil.descricao}</small>
              <span>Nível {perfil.nivel}</span>
            </article>
          ))}
        </div>
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

function Sincronizacao() {
  return (
    <div className="sigiu-admin-stack">
      <section className="sigiu-card sigiu-admin-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Sincronização e cache</h2>
            <p>Estrutura inicial para reduzir consultas completas e preparar updates incrementais.</p>
          </div>
          <button type="button" className="sigiu-btn sigiu-btn--primary">Forçar atualização</button>
        </header>
        <div className="sigiu-admin-sync-grid">
          {SIGIU_ADMIN_SYNC_STATUS.map((item) => (
            <article key={item.modulo}>
              <div>
                <strong>{item.modulo}</strong>
                <StatusChip status={item.status} />
              </div>
              <span>Modo: {item.modo}</span>
              <small>Última sincronização: {item.ultimaSincronizacao}</small>
              <small>Incremental: {item.incremental}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="sigiu-card sigiu-admin-card sigiu-admin-card--notice sigiu-admin-card--sync-note">
        <header>
          <span>↻</span>
          <div>
            <h2>Estratégia recomendada</h2>
            <p>
              Hidrômetros devem usar sincronização incremental por nova linha do Google Forms. PPCI e Obras devem usar ID fixo,
              updatedAt e hash da linha para identificar apenas registros modificados.
            </p>
          </div>
        </header>
      </section>
    </div>
  );
}

function Auditoria() {
  return (
    <section className="sigiu-card sigiu-admin-card">
      <header className="sigiu-card-header-row">
        <div>
          <h2>Auditoria</h2>
          <p>Registro estrutural de eventos administrativos. Logs reais dependem da autenticação/backend.</p>
        </div>
      </header>
      <div className="sigiu-admin-audit-list">
        {SIGIU_ADMIN_AUDITORIA.map((evento) => (
          <article key={`${evento.data}-${evento.acao}`}>
            <span>{evento.data}</span>
            <div>
              <strong>{evento.acao}</strong>
              <small>{evento.usuario} · {evento.detalhe}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function renderizarAba(abaAtiva, basesPrecos) {
  switch (abaAtiva) {
    case "bases-precos":
      return <GerenciarBasesPrecos basesPrecos={basesPrecos} />;
    case "fontes":
      return <FontesDados />;
    case "usuarios":
      return <UsuariosAcessos />;
    case "cadastros":
      return <CadastrosMestres />;
    case "parametros":
      return <ParametrosAlertas />;
    case "sync":
      return <Sincronizacao />;
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
            Governança do SIGIU: usuários, níveis de acesso, fontes de dados, cadastros mestres,
            parâmetros de alerta, sincronização e auditoria.
          </p>
        </div>
        <div className="sigiu-page-heading__meta sigiu-page-heading__meta--admin">
          <strong>8.1</strong>
          <span>base gerencial</span>
        </div>
      </div>

      <div className="sigiu-module-kpis sigiu-admin-kpis">
        <article className="sigiu-module-kpi sigiu-module-kpi--primary">
          <span>⚙</span>
          <small>Fontes de dados</small>
          <strong>{SIGIU_ADMIN_FONTES_DADOS.length}</strong>
          <em>módulos mapeados</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--info">
          <span>👤</span>
          <small>Usuários</small>
          <strong>{SIGIU_ADMIN_USUARIOS.length}</strong>
          <em>estrutura inicial</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--warning">
          <span>↻</span>
          <small>Sincronização</small>
          <strong>Inc.</strong>
          <em>incremental prevista</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--success">
          <span>✓</span>
          <small>Base</small>
          <strong>OK</strong>
          <em>pronta para Sprint 9</em>
        </article>
      </div>

      <nav className="sigiu-admin-tabs" aria-label="Abas da Administração SIGIU">
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
