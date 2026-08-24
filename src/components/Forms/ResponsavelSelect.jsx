export default function ResponsavelSelect({ responsaveis = { usuarios: [], equipes: [] }, name = "responsavel", defaultValue = "", required = false, rotulo = "Responsável" }) {
  const opcoes = [
    ...(responsaveis.usuarios || []).map((item) => ({ ...item, grupo: "Usuários do cliente" })),
    ...(responsaveis.equipes || []).map((item) => ({ ...item, grupo: "Grupos do cliente" })),
  ];
  const valorConhecido = opcoes.some((item) => item.nome === defaultValue);
  return <label>{rotulo}<select name={name} required={required} defaultValue={defaultValue}>
    <option value="">Selecione</option>
    {!valorConhecido && defaultValue && <option value={defaultValue}>{defaultValue} · cadastro anterior</option>}
    {["Usuários do cliente", "Grupos do cliente"].map((grupo) => <optgroup key={grupo} label={grupo}>{opcoes.filter((item) => item.grupo === grupo).map((item) => <option key={`${item.tipo}:${item.id}`} value={item.nome}>{item.nome}</option>)}</optgroup>)}
  </select></label>;
}
