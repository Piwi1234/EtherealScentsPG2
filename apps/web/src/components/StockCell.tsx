/** Celda compacta de stock (suma de todas las variantes/almacenes del producto, ver Product.stockDisponible
 * en lib/types.ts) — usada en la tabla de Productos y en el buscador de proformas. "—" si no hay nada
 * cargado; si no, Disponible en verde arriba y Reservado en rojo abajo. */
export function StockCell({ disponible, reservado }: { disponible: number; reservado: number }) {
  if (disponible === 0 && reservado === 0) {
    return <span className="cell-muted">—</span>;
  }
  return (
    <div style={{ fontSize: 11, lineHeight: 1.5, whiteSpace: "nowrap" }}>
      <div style={{ color: "#4caf50", fontWeight: 600 }}>Disp: {disponible}</div>
      <div style={{ color: "var(--danger)", fontWeight: 600 }}>Res: {reservado}</div>
    </div>
  );
}
