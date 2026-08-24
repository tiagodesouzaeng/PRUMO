/* =====================================================
   RELEASE........: v7.2.0 RC1
   ARQUIVO........: src/pages/PlaceholderModulo.jsx
   DESCRIÇÃO......: Página estrutural para módulos futuros do SIGIU
===================================================== */

export default function PlaceholderModulo({ modulo, descricao, icone = "▣" }) {
  return (
    <section className="sigiu-page sigiu-page-placeholder">
      <div className="sigiu-placeholder sigiu-card">
        <span className="sigiu-placeholder__icon">{icone}</span>
        <div>
          <span className="sigiu-page-eyebrow">Módulo PRUMO</span>
          <h1>{modulo}</h1>
          <p>{descricao}</p>
        </div>
        <div className="sigiu-placeholder__notice">
          Estrutura visual preparada para integração com os dados corporativos do módulo.
        </div>
      </div>
    </section>
  );
}
