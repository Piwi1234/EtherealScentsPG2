"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, cambiarOrigenVenta } from "../../lib/api";
import type { Proforma } from "../../lib/types";
import { Modal } from "../Modal";

type Cambio = { pasar: number; volver: number };

/**
 * Cambia el origen de unidades sueltas de una nota de venta aprobada (solo administrador). «Pasar a pedido» libera lo reservado en el
 * almacén y lo deja como pedido de Seguimiento a propósito (no se toma stock para él); «Volver a stock» revierte unidades de pedido
 * que todavía no tienen compra ligada y reserva el stock libre que haya. No cambia el total ni los pagos.
 */
export function CambiarOrigenModal({ proforma, onClose }: { proforma: Pick<Proforma, "id" | "codigo" | "detalles">; onClose: () => void }) {
  const router = useRouter();
  const [cambios, setCambios] = useState<Record<string, Cambio>>({});
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const lineas = proforma.detalles.map((d) => {
    const activas = d.asignaciones.filter((a) => a.cantidad > 0);
    const suma = (f: (a: (typeof activas)[number]) => boolean) => activas.filter(f).reduce((n, a) => n + a.cantidad, 0);
    return {
      d,
      stock: suma((a) => a.origen === "STOCK"),
      transito: suma((a) => a.origen === "EN_TRANSITO"),
      pedidoLibre: suma((a) => a.origen === "PROCURA" && Boolean(a.soloPedido) && !a.compraDetalle),
      pedidoLigado: suma((a) => a.origen === "PROCURA" && Boolean(a.soloPedido) && Boolean(a.compraDetalle)),
      faltante: suma((a) => a.origen === "PROCURA" && !a.soloPedido),
      /** ml por presentación: un decant se mueve por presentación (internamente la línea está en ml). */
      paso: d.presentacionVenta?.cantidadMl ?? 1,
    };
  });

  const hayCambios = Object.values(cambios).some((c) => c.pasar > 0 || c.volver > 0);
  const poner = (detalleId: string, cambio: Cambio) => setCambios((prev) => ({ ...prev, [detalleId]: cambio }));

  function Stepper({ valor, max, paso, onChange, etiqueta }: { valor: number; max: number; paso: number; onChange: (v: number) => void; etiqueta: string }) {
    const vista = valor / paso;
    const maxVista = Math.floor(max / paso);
    return (
      <span className="qty-stepper">
        <button type="button" aria-label="Menos" disabled={valor <= 0} onClick={() => onChange(Math.max(0, valor - paso))}>
          −
        </button>
        <input
          type="number"
          min={0}
          max={maxVista}
          step={1}
          value={vista}
          disabled={maxVista <= 0}
          aria-label={etiqueta}
          onChange={(e) => onChange(Math.max(0, Math.min(maxVista, parseInt(e.target.value, 10) || 0)) * paso)}
        />
        <button type="button" aria-label="Más" disabled={valor + paso > maxVista * paso} onClick={() => onChange(Math.min(maxVista * paso, valor + paso))}>
          +
        </button>
      </span>
    );
  }

  async function confirmar() {
    const payload = Object.entries(cambios)
      .filter(([, c]) => c.pasar > 0 || c.volver > 0)
      .map(([detalleId, c]) => ({ detalleId, pasarAPedido: c.pasar || undefined, volverAStock: c.volver || undefined }));
    if (payload.length === 0) return;
    setGuardando(true);
    setError("");
    try {
      await cambiarOrigenVenta(proforma.id, { lineas: payload, motivo: motivo.trim() || undefined });
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title={`Cambiar el origen de la nota ${proforma.codigo}`} onClose={onClose} maxWidth={980}>
      <p className="cell-muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
        «Pasar a pedido» libera lo reservado en el almacén y lo deja como pedido de Seguimiento: no se toma stock para esas unidades, aunque haya.
        Se cubren cuando llegue la compra a la que las ligues. «Volver a stock» revierte los pedidos que aún no tienen compra y toma el stock libre
        que haya. El total y los pagos no cambian.
      </p>

      <div className="table-scroll">
        <table className="table table-minimal table-compact">
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>Producto</th>
              <th className="num">Del almacén</th>
              <th className="num">Pedido a propósito</th>
              <th className="num">Faltante</th>
              <th className="num">Pasar a pedido</th>
              <th className="num">Volver a stock</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map(({ d, stock, transito, pedidoLibre, pedidoLigado, faltante, paso }) => {
              const c = cambios[d.id] ?? { pasar: 0, volver: 0 };
              const reservable = stock + transito;
              const u = (n: number) => n / paso;
              return (
                <tr key={d.id} style={c.pasar > 0 || c.volver > 0 ? { background: "rgba(201, 169, 110, 0.1)" } : undefined}>
                  <td className="cell-primary">
                    {d.variante.product.name}
                    {d.presentacionVenta && <span className="cell-muted" style={{ fontWeight: 400 }}> · {d.presentacionVenta.cantidadMl} ML</span>}
                    {d.comboNombre && <span className="cell-muted" style={{ fontWeight: 400 }}> · Combo {d.comboNombre}</span>}
                    <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>Cantidad: {u(d.cantidad)}</div>
                  </td>
                  <td className="num">
                    {u(stock)}
                    {transito > 0 && <div className="cell-muted" style={{ fontSize: 11.5 }}>+ {u(transito)} en tránsito</div>}
                  </td>
                  <td className="num">
                    {u(pedidoLibre + pedidoLigado)}
                    {pedidoLigado > 0 && <div className="cell-muted" style={{ fontSize: 11.5 }}>{u(pedidoLigado)} con compra ligada</div>}
                  </td>
                  <td className="num cell-muted">{u(faltante)}</td>
                  <td className="num">
                    <Stepper
                      valor={c.pasar}
                      max={reservable}
                      paso={paso}
                      etiqueta={`Unidades de ${d.variante.product.name} a pasar a pedido`}
                      onChange={(v) => poner(d.id, { pasar: v, volver: 0 })}
                    />
                  </td>
                  <td className="num">
                    <Stepper
                      valor={c.volver}
                      max={pedidoLibre}
                      paso={paso}
                      etiqueta={`Unidades de ${d.variante.product.name} a volver a stock`}
                      onChange={(v) => poner(d.id, { pasar: 0, volver: v })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="filter-field" style={{ margin: "14px 0 12px" }}>
        <label className="filter-label">Motivo (opcional)</label>
        <input className="field" value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. el cliente quiere el pedido nuevo, no el de la tienda" />
      </div>

      {error && <p className="error-text">{error}</p>}
      <div className="form-actions">
        <button type="button" className="link-button" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="button" disabled={guardando || !hayCambios} onClick={confirmar}>
          {guardando ? "Aplicando..." : "Aplicar cambios"}
        </button>
      </div>
    </Modal>
  );
}
