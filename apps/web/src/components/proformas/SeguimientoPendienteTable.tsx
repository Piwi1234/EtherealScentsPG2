"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, updateSeguimientoEstado } from "../../lib/api";
import type { EstadoSeguimientoProcura, SeguimientoLinea } from "../../lib/types";
import { formatAtributosVisibles } from "./AtributosVisibles";
import { LABELS_SEGUIMIENTO, ORDEN_SEGUIMIENTO } from "./seguimiento-estados";

function formatFecha(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

/** Qué distingue a esta variante puntual + los atributos heredados de la categoría marcados para
 * mostrarse en proforma — mismo criterio que ProformaDetalleTable, para que se vea igual acá. */
function atributosLabel(variante: SeguimientoLinea["proformaDetalle"]["variante"]): string | null {
  const opciones = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(variante.product.attributeValues, variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

function Fila({ linea }: { linea: SeguimientoLinea }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { proforma, variante } = linea.proformaDetalle;
  const etiqueta = atributosLabel(variante);

  async function handleEstadoChange(estado: EstadoSeguimientoProcura) {
    setSaving(true);
    setError("");
    try {
      await updateSeguimientoEstado(linea.id, estado);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td className="cell-muted">{formatFecha(proforma.fecha)}</td>
      <td>{proforma.empresa.nombre}</td>
      <td className="cell-muted">{variante.product.brand?.name ?? "—"}</td>
      <td className="cell-primary">
        {variante.product.name}
        <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>
          {variante.variantCode}
          {etiqueta && <> · {etiqueta}</>}
        </div>
      </td>
      <td className="num">{linea.cantidad}</td>
      <td>
        <select
          className="field"
          value={linea.estadoSeguimiento}
          disabled={saving}
          onChange={(e) => handleEstadoChange(e.target.value as EstadoSeguimientoProcura)}
        >
          {ORDEN_SEGUIMIENTO.map((estado) => (
            <option key={estado} value={estado}>
              {LABELS_SEGUIMIENTO[estado]}
            </option>
          ))}
        </select>
        {error && <p className="error-text" style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}>{error}</p>}
      </td>
      <td>
        <Link href={`/dashboard/proformas/${proforma.id}`} className="link-button">
          Ver proforma
        </Link>
      </td>
    </tr>
  );
}

/**
 * Todo lo que hoy está a Procura (venta aprobada sin stock suficiente todavía), de cualquier proforma
 * — la vista operativa de "qué falta pedirle al proveedor". Se recalcula en vivo: cambia solo cuando
 * una compra resuelve la Procura o se anula la venta que la generaba.
 */
export function SeguimientoPendienteTable({ lineas }: { lineas: SeguimientoLinea[] }) {
  if (lineas.length === 0) {
    return <p className="cell-muted">No hay productos a Procura para estos filtros.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="table table-minimal">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Empresa</th>
            <th>Marca</th>
            <th>Producto</th>
            <th className="num">Cant.</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((linea) => (
            <Fila key={linea.id} linea={linea} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
