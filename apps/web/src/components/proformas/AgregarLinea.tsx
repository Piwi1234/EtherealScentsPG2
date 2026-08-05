"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, addDetalleCompra, addDetalleVenta } from "../../lib/api";
import type { Product, ProductVariant, TipoProforma } from "../../lib/types";
import { VarianteSelector } from "./VarianteSelector";

/**
 * Combina el buscador de variantes con el mini-formulario de cantidad/precio (venta) o los 4 costos
 * (compra) que hace falta completar antes de poder mandar la línea — el backend exige esos campos,
 * no hay forma de "agregar y editar después" para precioCompra/costos.
 */
export function AgregarLinea({ proformaId, tipo }: { proformaId: string; tipo: TipoProforma }) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState<{ producto: Product; variante: ProductVariant } | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [precioUnitario, setPrecioUnitario] = useState(0);
  const [precioCompra, setPrecioCompra] = useState(0);
  const [costoEnvio, setCostoEnvio] = useState(0);
  const [costoSeguridad, setCostoSeguridad] = useState(0);
  const [costoLogistica, setCostoLogistica] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSelect({ producto, variante }: { producto: Product; variante: ProductVariant }) {
    setSeleccion({ producto, variante });
    setCantidad(1);
    setPrecioUnitario(variante.finalPriceBs);
    setPrecioCompra(Number(variante.purchasePrice));
    setCostoEnvio(0);
    setCostoSeguridad(0);
    setCostoLogistica(0);
    setError("");
  }

  async function handleAgregar() {
    if (!seleccion) return;
    setSubmitting(true);
    setError("");
    try {
      if (tipo === "VENTA") {
        await addDetalleVenta(proformaId, { varianteId: seleccion.variante.id, cantidad, precioUnitario });
      } else {
        await addDetalleCompra(proformaId, {
          varianteId: seleccion.variante.id,
          cantidad,
          precioCompra,
          costoEnvio,
          costoSeguridad,
          costoLogistica,
        });
      }
      setSeleccion(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!seleccion) {
    return <VarianteSelector onSelect={handleSelect} />;
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="cell-primary">{seleccion.producto.name}</span>
        <button type="button" className="link-button" onClick={() => setSeleccion(null)}>
          Cambiar producto
        </button>
      </div>
      <div className="filters-bar">
        <div className="filter-field">
          <label className="filter-label">Cantidad</label>
          <input
            className="field"
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(parseInt(e.target.value, 10) || 1)}
            style={{ width: 90 }}
          />
        </div>
        {tipo === "VENTA" ? (
          <div className="filter-field">
            <label className="filter-label">Precio unitario (Bs)</label>
            <input
              className="field"
              type="number"
              min={0}
              step="0.01"
              value={precioUnitario}
              onChange={(e) => setPrecioUnitario(Number(e.target.value))}
              style={{ width: 110 }}
            />
          </div>
        ) : (
          <>
            <div className="filter-field">
              <label className="filter-label">Compra ($)</label>
              <input
                className="field"
                type="number"
                min={0}
                step="0.01"
                value={precioCompra}
                onChange={(e) => setPrecioCompra(Number(e.target.value))}
                style={{ width: 90 }}
              />
            </div>
            <div className="filter-field">
              <label className="filter-label">Envío ($)</label>
              <input
                className="field"
                type="number"
                min={0}
                step="0.01"
                value={costoEnvio}
                onChange={(e) => setCostoEnvio(Number(e.target.value))}
                style={{ width: 90 }}
              />
            </div>
            <div className="filter-field">
              <label className="filter-label">Seguridad ($)</label>
              <input
                className="field"
                type="number"
                min={0}
                step="0.01"
                value={costoSeguridad}
                onChange={(e) => setCostoSeguridad(Number(e.target.value))}
                style={{ width: 90 }}
              />
            </div>
            <div className="filter-field">
              <label className="filter-label">Logística ($)</label>
              <input
                className="field"
                type="number"
                min={0}
                step="0.01"
                value={costoLogistica}
                onChange={(e) => setCostoLogistica(Number(e.target.value))}
                style={{ width: 90 }}
              />
            </div>
          </>
        )}
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button type="button" className="action-btn" onClick={handleAgregar} disabled={submitting}>
            {submitting ? "Agregando..." : "Agregar línea"}
          </button>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
