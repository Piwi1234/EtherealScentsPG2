"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, addComboToProforma, getCombos } from "../../lib/api";
import { productImageSrc } from "../../lib/catalog-display";
import type { Combo } from "../../lib/types";

function bs(n: number): string {
  return `Bs ${n.toFixed(2)}`;
}

/**
 * Vender combos en una nota de venta en borrador: se elige el combo y cuántos, y se agregan sus productos como líneas normales con
 * el descuento del combo repartido. Solo se ofrece en VENTA y, si no hay combos creados, no aparece.
 */
export function AgregarComboPanel({ proformaId }: { proformaId: string }) {
  const [combos, setCombos] = useState<Combo[] | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getCombos()
      .then(setCombos)
      .catch(() => setCombos([]));
  }, []);

  async function agregar(combo: Combo) {
    const cantidad = cantidades[combo.id] ?? 1;
    setBusyId(combo.id);
    setError("");
    setAviso("");
    try {
      await addComboToProforma(proformaId, combo.id, cantidad);
      setAviso(`Agregado: ${cantidad} × ${combo.nombre}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!combos || combos.length === 0) return null;

  return (
    <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, marginBottom: 18 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Combos</h2>
      <p className="cell-muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
        Agrega un combo completo: se cargan sus productos con el descuento del combo ya repartido. Después puedes cambiar cuántos combos lleva la
        nota o quitarlo desde su encabezado.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {combos.map((combo) => {
          const img = productImageSrc(combo.imageUrl);
          const cantidad = cantidades[combo.id] ?? 1;
          return (
            <div key={combo.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 10 }}>
              {img ? (
                <img src={img} alt={combo.nombre} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} />
              ) : (
                <span className="cell-muted" style={{ width: 44, textAlign: "center", fontSize: 11 }}>sin imagen</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cell-primary">
                  {combo.nombre} <span className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>· {combo.category.name}</span>
                  {combo.agotado && <span className="badge badge-danger" style={{ marginLeft: 8 }}>Sin stock</span>}
                  {combo.preventa && <span className="badge badge-warn" style={{ marginLeft: 8 }}>Preventa</span>}
                </div>
                <div className="cell-muted" style={{ fontSize: 12 }}>
                  {combo.items.map((i) => `${i.cantidad > 1 ? `${i.cantidad}× ` : ""}${i.producto.name}${i.variante.etiqueta ? ` (${i.variante.etiqueta})` : ""}`).join(" + ")}
                </div>
              </div>
              <div style={{ textAlign: "right", minWidth: 120 }}>
                <div className="cell-primary">{bs(combo.totalBs)}</div>
                <div className="cell-muted" style={{ fontSize: 12 }}>
                  <s>{bs(combo.sumaBs)}</s> · ahorra {bs(combo.ahorroBs)}
                </div>
              </div>
              <span className="qty-stepper">
                <button type="button" aria-label="Menos" disabled={cantidad <= 1} onClick={() => setCantidades((p) => ({ ...p, [combo.id]: cantidad - 1 }))}>
                  −
                </button>
                <input type="number" readOnly value={cantidad} aria-label={`Cantidad de ${combo.nombre}`} />
                <button type="button" aria-label="Más" disabled={cantidad >= 99} onClick={() => setCantidades((p) => ({ ...p, [combo.id]: cantidad + 1 }))}>
                  +
                </button>
              </span>
              <button type="button" className="action-btn" disabled={busyId !== null} onClick={() => agregar(combo)}>
                {busyId === combo.id ? "Agregando..." : "Agregar combo"}
              </button>
            </div>
          );
        })}
      </div>
      {error && <p className="error-text" style={{ margin: "10px 0 0" }}>{error}</p>}
      {aviso && (
        <p style={{ margin: "10px 0 0", fontSize: 13 }}>
          {aviso}{" "}
          <Link href={`/dashboard/proformas/${proformaId}`} className="link-button">
            Ver la nota
          </Link>
        </p>
      )}
    </section>
  );
}
