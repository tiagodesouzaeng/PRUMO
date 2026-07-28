import prumoLogo from "../../assets/prumo-logo.png";

export default function PrumoLogo({ compacto = false, className = "" }) {
  return (
    <span
      className={`prumo-brand-logo ${compacto ? "is-compact" : ""} ${className}`.trim()}
      aria-label="PRUMO"
      role="img"
    >
      <img src={prumoLogo} alt="" aria-hidden="true" />
    </span>
  );
}
