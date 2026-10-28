/** Celda compacta de stock (suma de todas las variantes/almacenes del producto, ver Product.stockDisponible
 * en lib/types.ts) — usada en la tabla de Productos y en el buscador de proformas. "—" si no hay nada
 * cargado; si no, Disponible en verde arriba y Reservado en rojo abajo. Con `transito` (tabla de Productos), la
 * segunda línea pasa a ser lo disponible en tránsito, en azul, en lugar del reservado. */
export function StockCell({ disponible, reservado, transito }: { disponible: number; reservado: number; transito?: number }) {
  if (transito !== undefined) {
    if (disponible === 0 && transito === 0) {
      return <span className="cell-muted">—</span>;
    }
    return (
      <div style={{ fontSize: 11, lineHeight: 1.5, whiteSpace: "nowrap" }}>
        <div style={{ color: "#4caf50", fontWeight: 600 }}>Disp: {disponible}</div>
        <div style={{ color: "#38a9e0", fontWeight: 600, opacity: transito === 0 ? 0.45 : 1 }} title="Disponible en tránsito: viaja y no está apartado ni ligado a una nota">
          Trán: {transito}
        </div>
      </div>
    );
  }
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
