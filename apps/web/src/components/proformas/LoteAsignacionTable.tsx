"use client";

import { useEffect, useState } from "react";
import { getLotesCompra } from "../../lib/api";
import type { LoteCompraConDetalle } from "../../lib/types";

/** Reparto manual de una asignación STOCK entre los lotes de compra disponibles de esa
 * variante+almacén — precargado en FIFO (lotes más antiguos primero) y editable. Avisa al padre en
 * cada cambio vía `onChange`, con solo las filas que quedaron con cantidad > 0. */
export function LoteAsignacionTable({
  varianteId,
  almacenId,
  cantidadRequerida,
  nombreProducto,
  onChange,
}: {
  varianteId: string;
  almacenId: string;
  cantidadRequerida: number;
  nombreProducto: string;
  onChange: (entradas: { loteCompraId: string; cantidad: number }[]) => void;
}) {
  const [lotes, setLotes] = useState<LoteCompraConDetalle[] | null>(null);
  const [error, setError] = useState("");
  const [cantidadPorLote, setCantidadPorLote] = useState<Record<string, number>>({});

  useEffect(() => {
    getLotesCompra({ varianteId, almacenId, pageSize: 100 })
      .then((page) => {
        const disponibles = page.items.filter((l) => l.cantidadDisponible > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
        setLotes(disponibles);

        // Precarga FIFO: toma de los lotes más antiguos primero hasta cubrir cantidadRequerida.
        const prefill: Record<string, number> = {};
        let restante = cantidadRequerida;
        for (const lote of disponibles) {
          if (restante <= 0) break;
          const tomar = Math.min(lote.cantidadDisponible, restante);
          prefill[lote.id] = tomar;
          restante -= tomar;
        }
        setCantidadPorLote(prefill);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varianteId, almacenId]);

  useEffect(() => {
    const entradas = Object.entries(cantidadPorLote)
      .filter(([, cantidad]) => cantidad > 0)
      .map(([loteCompraId, cantidad]) => ({ loteCompraId, cantidad }));
    onChange(entradas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantidadPorLote]);

  const totalRepartido = Object.values(cantidadPorLote).reduce((sum, c) => sum + c, 0);
  const cuadra = totalRepartido === cantidadRequerida;

  if (error) return <p className="error-text">{error}</p>;
  if (!lotes) return <p className="cell-muted">Cargando lotes...</p>;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>{nombreProducto}</strong>
        <span className={cuadra ? "cell-muted" : "error-text"}>
          Repartido: {totalRepartido} / {cantidadRequerida}
        </span>
      </div>
      {lotes.length === 0 ? (
        <p className="error-text">No hay lotes disponibles para esta variante en el almacén elegido.</p>
      ) : (
        <table className="table table-minimal">
          <thead>
            <tr>
              <th>Fecha</th>
              <th className="num">Costo unitario</th>
              <th className="num">Disponible</th>
              <th className="num">Cantidad a tomar</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((lote) => (
              <tr key={lote.id}>
                <td className="cell-muted">{new Date(lote.fecha).toLocaleDateString("es-VE")}</td>
                <td className="num">$ {Number(lote.costoUnitario).toFixed(2)}</td>
                <td className="num">{lote.cantidadDisponible}</td>
                <td className="num">
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={lote.cantidadDisponible}
                    value={cantidadPorLote[lote.id] ?? 0}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(lote.cantidadDisponible, parseInt(e.target.value, 10) || 0));
                      setCantidadPorLote((prev) => ({ ...prev, [lote.id]: value }));
                    }}
                    style={{ width: 80, textAlign: "center" }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
