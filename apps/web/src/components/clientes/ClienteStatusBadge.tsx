export function ClienteStatusBadge({ activo }: { activo: boolean }) {
  return <span className={`badge${activo ? "" : " badge-danger"}`}>{activo ? "Activo" : "Inactivo"}</span>;
}
