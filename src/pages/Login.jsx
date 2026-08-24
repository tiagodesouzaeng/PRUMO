import { useEffect, useState } from "react";
import PrumoLogo from "../components/Brand/PrumoLogo";
import {
  entrarComContaLocal,
  iniciarLoginCorporativo,
  obterCapacidadesAcesso,
} from "../services/sessaoPrumo";

export default function Login({ configuracao, onEntrar }) {
  const [capacidades, setCapacidades] = useState(null);
  const [contingencia, setContingencia] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!configuracao.apiUrl) return;
    obterCapacidadesAcesso(configuracao.apiUrl)
      .then(setCapacidades)
      .catch((erro) => setMensagem(erro.message));
  }, [configuracao.apiUrl]);

  async function entrarLocal(evento) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    setCarregando(true); setMensagem("");
    try { onEntrar(await entrarComContaLocal(configuracao.apiUrl, dados.get("usuario"), dados.get("senha"))); }
    catch (erro) { setMensagem(erro.message); }
    finally { setCarregando(false); }
  }

  return <main className="prumo-login-shell">
    <section className="prumo-login-brand">
      <PrumoLogo />
      <div><span>PLATAFORMA CORPORATIVA</span><h1>Inteligência e gestão para engenharia, patrimônio e obras.</h1><p>Dados, custos, contratos e decisões reunidos com rastreabilidade e segurança.</p></div>
      <footer>PRUMO · Ambiente de acesso controlado</footer>
    </section>
    <section className="prumo-login-panel">
      <div className="prumo-login-card">
        <header><span>ACESSO AO PRUMO</span><h2>Entrar na plataforma</h2><p>Utilize sua identidade corporativa autorizada.</p></header>
        {!configuracao.apiUrl && <div className="prumo-login-feedback is-error"><strong>Ambiente não configurado</strong><span>A API autenticada precisa ser conectada antes de liberar a aplicação.</span></div>}
        {mensagem && <div className="prumo-login-feedback is-error" role="alert">{mensagem}</div>}
        <button type="button" className="prumo-login-primary" disabled={!configuracao.loginCorporativoConfigurado} onClick={() => iniciarLoginCorporativo(configuracao.authUrl)}>Entrar com conta corporativa</button>
        {!configuracao.loginCorporativoConfigurado && <small className="prumo-login-hint">O provedor corporativo será habilitado pela Administração do PRUMO.</small>}
        {capacidades?.contingenciaLocal && <div className="prumo-login-contingencia">
          <button type="button" className="prumo-login-link" aria-expanded={contingencia} onClick={() => setContingencia((atual) => !atual)}>Acesso administrativo de contingência</button>
          {contingencia && <form onSubmit={entrarLocal}>
            <label>Usuário<input name="usuario" autoComplete="username" required autoFocus /></label>
            <label>Senha<input name="senha" type="password" autoComplete="current-password" required /></label>
            <button className="prumo-login-primary" disabled={carregando}>{carregando ? "Validando…" : "Entrar em contingência"}</button>
            <p>Uso restrito, temporário e registrado nos logs de segurança.</p>
          </form>}
        </div>}
      </div>
    </section>
  </main>;
}
