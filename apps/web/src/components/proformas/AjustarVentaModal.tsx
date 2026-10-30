"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, ajustarVenta, getPagosProforma } from "../../lib/api";
import type { Cartera, PagosVenta, Proforma } from "../../lib/types";
import { Modal } from "../Modal";
import { CarteraSelector } from "./selectors";

function bs(n: number): string {
  return `Bs ${n.toFixed(2)}`;
}

/**
 * Ajuste de una nota de venta aprobada que no se puede completar tal cual: se quitan productos o se bajan cantidades. El
 * modal muestra el nuevo total y, si lo ya cobrado lo supera, el monto a devolver y la cartera de la que sale.
 */
export function AjustarVentaModal({
  proforma,
  carterasBs,
  onClose,
}: {
  proforma: Pick<Proforma, "id" | "codigo" | "detalles" | "descuentoGeneral">;
  carterasBs: Cartera[];
  onClose: () => void;
}) {
  const router = useRouter();
  // Nueva cantidad por línea, en las unidades de la línea (ml en ventas por presentación).
  const [nuevas, setNuevas] = useState<Record<string, number>>(() => Object.fromEntries(proforma.detalles.map((d) => [d.id, d.cantidad])));
  const [pagos, setPagos] = useState<PagosVenta | null>(null);
  const [carteraId, setCarteraId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    getPagosProforma(proforma.id)
      .then(setPagos)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, [proforma.id]);

  const subtotalNuevo = proforma.detalles.reduce((n, d) => n + (nuevas[d.id] ?? d.cantidad) * Number(d.precioUnitario ?? 0), 0);
  // Descuento por unidad: lo que se quita devuelve su precio menos su descuento.
  const descuento = proforma.detalles.reduce((n, d) => n + (nuevas[d.id] ?? d.cantidad) * Number(d.descuentoUnitario || 0), 0);
  const totalNuevo = Math.round((subtotalNuevo - descuento) * 100) / 100;
  const cobrado = pagos?.pagado ?? 0;
  const exceso = Math.max(0, Math.round((cobrado - totalNuevo) * 100) / 100);
  const cambios = proforma.detalles.filter((d) => (nuevas[d.id] ?? d.cantidad) !== d.cantidad);
  const sinProductos = proforma.detalles.every((d) => (nuevas[d.id] ?? d.cantidad) === 0);

  /** ml por presentación: un decant se ve y se baja por presentación (internamente la línea está en ml). */
  const pasoDe = (d: Proforma["detalles"][number]) => d.presentacionVenta?.cantidadMl ?? 1;

  async function confirmar() {
    if (cambios.length === 0) return;
    if (exceso > 0 && !carteraId) {
      setError(`Elegí la cartera de la que sale la devolución de ${bs(exceso)}.`);
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await ajustarVenta(proforma.id, {
        lineas: cambios.map((d) => ({ detalleId: d.id, cantidad: nuevas[d.id] ?? d.cantidad })),
        carteraId: exceso > 0 ? carteraId : undefined,
        motivo: motivo.trim() || undefined,
      });
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title={`Ajustar la nota ${proforma.codigo}`} onClose={onClose} maxWidth={860}>
      <p className="cell-muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
        Quita productos o baja cantidades de lo que no se pudo conseguir. Se libera lo reservado, se recalcula el total y, si ya se
        cobró más que el nuevo total, se devuelve la diferencia desde una cartera. No se pueden subir cantidades ni agregar productos.
      </p>

      <div className="table-scroll">
        <table className="table table-minimal table-compact">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="num">Cantidad actual</th>
              <th className="num">Cantidad nueva</th>
              <th className="num">Precio Bs</th>
              <th className="num">Desc. unit. Bs</th>
              <th className="num">Subtotal nuevo Bs (con desc.)</th>
            </tr>
          </thead>
          <tbody>
            {proforma.detalles.map((d) => {
              const nueva = nuevas[d.id] ?? d.cantidad;
              const paso = pasoDe(d);
              const vista = nueva / paso;
              const maxVista = d.cantidad / paso;
              return (
                <tr key={d.id} style={nueva !== d.cantidad ? { background: "rgba(201, 169, 110, 0.1)" } : undefined}>
                  <td className="cell-primary">
                    {d.variante.product.name}
                    {d.variante.product.brand?.name && <span className="cell-muted" style={{ fontWeight: 400 }}> · {d.variante.product.brand.name}</span>}
                    {d.presentacionVenta && <span className="cell-muted" style={{ fontWeight: 400 }}> · {d.presentacionVenta.cantidadMl} ml</span>}
                  </td>
                  <td className="num">{maxVista}</td>
                  <td className="num">
                    <span className="qty-stepper">
                      <button type="button" aria-label="Menos" disabled={nueva <= 0} onClick={() => setNuevas((p) => ({ ...p, [d.id]: Math.max(0, nueva - paso) }))}>
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={maxVista}
                        step={1}
                        value={vista}
                        aria-label={`Cantidad nueva de ${d.variante.product.name}`}
                        onChange={(e) => setNuevas((p) => ({ ...p, [d.id]: Math.max(0, Math.min(maxVista, parseInt(e.target.value, 10) || 0)) * paso }))}
                      />
                      <button type="button" aria-label="Más" disabled={nueva >= d.cantidad} onClick={() => setNuevas((p) => ({ ...p, [d.id]: Math.min(d.cantidad, nueva + paso) }))}>
                        +
                      </button>
                    </span>
                    <div>
                      <button type="button" className="link-button" style={{ fontSize: 12 }} onClick={() => setNuevas((p) => ({ ...p, [d.id]: 0 }))}>
                        Quitar producto
                      </button>
                    </div>
                  </td>
                  <td className="num cell-muted">{(Number(d.precioUnitario ?? 0) * paso).toFixed(2)}</td>
                  <td className="num cell-muted">{(Number(d.descuentoUnitario || 0) * paso).toFixed(2)}</td>
                  <td className="num">{(nueva * (Number(d.precioUnitario ?? 0) - Number(d.descuentoUnitario || 0))).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gap: 4, justifyContent: "end", margin: "14px 0", textAlign: "right" }}>
        <span className="cell-muted">Total actual: {pagos ? bs(pagos.total) : "…"}</span>
        <strong style={{ fontSize: 16 }}>Nuevo total: {bs(totalNuevo)}</strong>
        <span className="cell-muted">Cobrado hasta ahora: {pagos ? bs(cobrado) : "…"}</span>
        {pagos && (
          <span style={{ color: exceso > 0 ? "var(--es-gold, #c9a96e)" : undefined, fontWeight: exceso > 0 ? 700 : 400 }}>
            {exceso > 0 ? `A devolver al cliente: ${bs(exceso)}` : `Saldo pendiente: ${bs(Math.max(0, totalNuevo - cobrado))}`}
          </span>
        )}
      </div>

      {exceso > 0 && (
        <div className="filter-field" style={{ marginBottom: 12 }}>
          <label className="filter-label">Devolver desde la cartera (Bs)</label>
          <CarteraSelector options={carterasBs} value={carteraId} onChange={setCarteraId} placeholder="— Elegir cartera —" />
          <p className="cell-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
            Se registra un egreso en esa cartera por la devolución, ligado a esta nota.
          </p>
        </div>
      )}

      <div className="filter-field" style={{ marginBottom: 12 }}>
        <label className="filter-label">Motivo (opcional)</label>
        <input className="field" value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. el proveedor no entregó 2 unidades" />
      </div>

      {sinProductos && <p className="error-text">Con esos cambios la nota queda sin productos: mejor anulala desde la pantalla de la nota.</p>}
      {error && <p className="error-text">{error}</p>}
      <div className="form-actions">
        <button type="button" className="link-button" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="button" disabled={guardando || cambios.length === 0 || sinProductos || !pagos} onClick={confirmar}>
          {guardando ? "Aplicando..." : "Aplicar ajuste"}
        </button>
      </div>
    </Modal>
  );
}
