"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, createSeguimiento } from "../../lib/api";
import type { SeguimientoLinea } from "../../lib/types";
import { formatAtributosVisibles } from "./AtributosVisibles";
import { LABELS_SEGUIMIENTO, siguienteEstadoSeguimiento } from "./seguimiento-estados";

function formatFecha(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function atributosLabel(linea: SeguimientoLinea): string | null {
  const opciones = linea.variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(linea.variante.product.attributeValues, linea.variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

function Fila({ linea }: { linea: SeguimientoLinea }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const siguiente = siguienteEstadoSeguimiento(linea.estadoActual);
  const etiqueta = atributosLabel(linea);
  const contraparte = linea.proforma.tipo === "VENTA" ? linea.proforma.cliente?.nombre : linea.proforma.almacen?.nombre;

  async function handleAvanzar() {
    if (!siguiente) return;
    setSubmitting(true);
    setError("");
    try {
      await createSeguimiento(linea.id, { estado: siguiente, nota: nota || undefined });
      setNota("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <tr>
        <td className="cell-muted">{formatFecha(linea.proforma.fecha)}</td>
        <td>
          <span className="badge">{linea.proforma.tipo === "VENTA" ? "Venta" : "Compra"}</span>
        </td>
        <td>
          {linea.proforma.empresa.nombre}
          <div className="cell-muted" style={{ fontSize: 12 }}>{contraparte ?? "—"}</div>
        </td>
        <td className="cell-muted">{linea.variante.product.brand?.name ?? "—"}</td>
        <td className="cell-primary">
          {linea.variante.product.name}
          {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
        </td>
        <td className="num">{linea.cantidad}</td>
        <td>
          <span className="badge badge-accent">{LABELS_SEGUIMIENTO[linea.estadoActual]}</span>
        </td>
        <td>
          <Link href={`/dashboard/proformas/${linea.proforma.id}`} className="link-button">
            Ver proforma
          </Link>
        </td>
      </tr>
      {siguiente && (
        <tr>
          <td colSpan={8} style={{ paddingTop: 0, borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                className="field"
                placeholder="Nota (opcional)"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                style={{ flex: 1, minWidth: 160 }}
              />
              <button type="button" className="action-btn" onClick={handleAvanzar} disabled={submitting}>
                {submitting ? "Guardando..." : `Marcar como ${LABELS_SEGUIMIENTO[siguiente]}`}
              </button>
            </div>
            {error && <p className="error-text" style={{ marginTop: 6 }}>{error}</p>}
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Todas las líneas con seguimiento habilitado, de cualquier proforma APROBADA/COMPLETADA — la vista
 * operativa de "qué falta comprar/enviar/recibir hoy", sin tener que entrar proforma por proforma.
 */
export function SeguimientoPendienteTable({ lineas }: { lineas: SeguimientoLinea[] }) {
  if (lineas.length === 0) {
    return <p className="cell-muted">No hay líneas con seguimiento para estos filtros.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="table table-minimal">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Empresa / Contraparte</th>
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
