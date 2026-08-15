"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, removeDetalle, updateDetalle } from "../../lib/api";
import type { Proforma, ProformaDetalle, TipoProforma } from "../../lib/types";
import { formatAtributosVisibles } from "./AtributosVisibles";

/** Qué distingue a esta variante puntual (ej. "Tamaño: 50 ML") + los atributos heredados de la
 * categoría marcados para mostrarse en proforma +, si es una venta fraccionada (unidad=ML), qué
 * presentación se vendió (ej. "Presentación: 10 ml") — todo concatenado en una sola línea bajo el nombre. */
function atributosLabel(detalle: ProformaDetalle): string | null {
  const opciones = detalle.variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(detalle.variante.product.attributeValues, detalle.variante.product.variantOptionValues);
  const presentacion = detalle.presentacionVenta ? `Presentación: ${detalle.presentacionVenta.cantidadMl} ml` : null;
  const partes = [...opciones, ...(heredados ? [heredados] : []), ...(presentacion ? [presentacion] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

function money(value: string | null, prefix: string): string {
  return `${prefix} ${Number(value ?? 0).toFixed(2)}`;
}

function EditableNumber({
  value,
  min = 0,
  step,
  onCommit,
}: {
  value: number | string | null;
  min?: number;
  step?: string;
  onCommit: (value: number) => void;
}) {
  return (
    <input
      className="field"
      type="number"
      min={min}
      step={step ?? "0.01"}
      defaultValue={value ?? 0}
      onBlur={(e) => {
        const parsed = Number(e.target.value);
        if (!Number.isNaN(parsed)) onCommit(parsed);
      }}
      style={{ width: 70, textAlign: "center" }}
    />
  );
}

function DetalleRow({
  proformaId,
  detalle,
  tipo,
  editable,
  tipoCambioProf,
}: {
  proformaId: string;
  detalle: ProformaDetalle;
  tipo: TipoProforma;
  editable: boolean;
  tipoCambioProf: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const colSpan = (tipo === "VENTA" ? 6 : 10) + (editable ? 1 : 0);

  async function commit(patch: Partial<import("../../lib/types").UpdateDetalleInput>) {
    setError("");
    try {
      await updateDetalle(proformaId, detalle.id, patch);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function handleRemove() {
    if (!confirm("¿Quitar esta línea de la proforma?")) return;
    setRemoving(true);
    setError("");
    try {
      await removeDetalle(proformaId, detalle.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setRemoving(false);
    }
  }

  const etiqueta = atributosLabel(detalle);

  return (
    <>
      <tr>
        <td className="cell-code">{detalle.variante.product.productCode}</td>
        <td className="cell-muted">{detalle.variante.product.brand?.name ?? "—"}</td>
        <td className="cell-primary">
          {detalle.variante.product.name}
          {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
        </td>
        <td className="num">
          {editable ? (
            <EditableNumber value={detalle.cantidad} min={1} step="1" onCommit={(v) => commit({ cantidad: v })} />
          ) : (
            detalle.cantidad
          )}
        </td>
        {tipo === "VENTA" ? (
          <td className="num">
            {editable ? (
              <EditableNumber value={detalle.precioUnitario} onCommit={(v) => commit({ precioUnitario: v })} />
            ) : (
              money(detalle.precioUnitario, "Bs")
            )}
          </td>
        ) : (
          <>
            <td className="num">
              {editable ? (
                <EditableNumber value={detalle.precioCompra} onCommit={(v) => commit({ precioCompra: v })} />
              ) : (
                money(detalle.precioCompra, "$")
              )}
            </td>
            <td className="num">
              {editable ? (
                <EditableNumber value={detalle.costoEnvio} onCommit={(v) => commit({ costoEnvio: v })} />
              ) : (
                money(detalle.costoEnvio, "$")
              )}
            </td>
            <td className="num">
              {editable ? (
                <EditableNumber value={detalle.costoSeguridad} onCommit={(v) => commit({ costoSeguridad: v })} />
              ) : (
                money(detalle.costoSeguridad, "$")
              )}
            </td>
            <td className="num">
              {editable ? (
                <EditableNumber value={detalle.costoLogistica} onCommit={(v) => commit({ costoLogistica: v })} />
              ) : (
                money(detalle.costoLogistica, "$")
              )}
            </td>
          </>
        )}
        <td className="num cell-primary">{money(detalle.subtotal, tipo === "VENTA" ? "Bs" : "$")}</td>
        {tipo === "COMPRA" && (
          <td className="num cell-primary">
            {tipoCambioProf ? `Bs ${(Number(detalle.subtotal) * Number(tipoCambioProf)).toFixed(2)}` : "—"}
          </td>
        )}
        {editable && (
          <td className="num">
            <button type="button" className="action-btn danger" onClick={handleRemove} disabled={removing}>
              Quitar
            </button>
          </td>
        )}
      </tr>
      {error && (
        <tr>
          <td colSpan={colSpan} className="error-text" style={{ borderBottom: "1px solid var(--line)" }}>
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Tabla dual VENTA/COMPRA de líneas de una proforma. `editable` habilita inputs inline (cantidad +
 * precio en venta, cantidad + los 4 costos en compra) que guardan con onBlur — cada campo es su
 * propio PATCH, sin estado local de formulario. Se usa tanto en el constructor (BORRADOR) como en
 * modo solo-lectura (APROBADA/COMPLETADA/ANULADA), pasando `editable={false}`.
 */
export function ProformaDetalleTable({ proforma, editable }: { proforma: Proforma; editable: boolean }) {
  const { tipo, detalles } = proforma;

  if (detalles.length === 0) {
    return <p className="cell-muted">Todavía no hay líneas en esta proforma.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="table table-minimal">
        <thead>
          <tr>
            <th>ID Producto</th>
            <th>Marca</th>
            <th style={{ minWidth: 240 }}>Producto</th>
            <th className="num">Cant.</th>
            {tipo === "VENTA" ? (
              <th className="num">Precio unitario</th>
            ) : (
              <>
                <th className="num">Compra</th>
                <th className="num">Envío</th>
                <th className="num">Seguridad</th>
                <th className="num">Logística</th>
              </>
            )}
            <th className="num">Subtotal</th>
            {tipo === "COMPRA" && <th className="num">Subtotal Bs</th>}
            {editable && <th></th>}
          </tr>
        </thead>
        <tbody>
          {detalles.map((detalle) => (
            <DetalleRow
              key={`${detalle.id}-${detalle.updatedAt}`}
              proformaId={proforma.id}
              detalle={detalle}
              tipo={tipo}
              editable={editable}
              tipoCambioProf={proforma.tipoCambioProf}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
