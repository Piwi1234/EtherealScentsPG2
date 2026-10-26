"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, desvincularLineaSolicitud } from "../../lib/api";
import type { SolicitudLineaSeguimiento } from "../../lib/types";
import { EnviosDeLinea } from "./EnviosDeLinea";
import { CrearComprasModal } from "./CrearComprasModal";
import { formatAtributosVisibles } from "./AtributosVisibles";
import { CLASES_LINEA_SOLICITUD, LABELS_LINEA_SOLICITUD } from "./seguimiento-estados";

function formatFecha(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function atributosLabel(variante: SolicitudLineaSeguimiento["variante"]): string | null {
  const opciones = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(variante.product.attributeValues, variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

/**
 * Stock solicitado: las líneas de solicitudes de stock abiertas que todavía no llegaron, con el estado de la
 * compra y el envío que las cubren. Se compran con "Crear compras" (una nota por proveedor).
 */
export function SeguimientoSolicitudTable({ lineas }: { lineas: SolicitudLineaSeguimiento[] }) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const sinCompra = lineas.filter((l) => !l.compraDetalleId);
  const todosElegidos = sinCompra.length > 0 && sinCompra.every((l) => seleccion.has(l.id));

  function alternar(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSoltar(linea: SolicitudLineaSeguimiento) {
    setBusyId(linea.id);
    setError("");
    try {
      await desvincularLineaSolicitud(linea.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (lineas.length === 0) {
    return <p className="cell-muted">No hay productos solicitados pendientes con estos filtros.</p>;
  }

  return (
    <>
      {error && <p className="error-text">{error}</p>}
      {sinCompra.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span className="cell-muted" style={{ fontSize: 12.5 }}>
            {seleccion.size > 0 ? `${seleccion.size} elegido${seleccion.size === 1 ? "" : "s"}` : `${sinCompra.length} sin compra`}
          </span>
          <button type="button" className="btn-cta" disabled={seleccion.size === 0} onClick={() => setCreando(true)}>
            <span className="btn-cta-icon">+</span> Crear compras
          </button>
        </div>
      )}
      <div className="table-scroll">
        <table className="table table-minimal table-compact">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                {sinCompra.length > 0 && (
                  <input
                    type="checkbox"
                    aria-label="Elegir todas las líneas sin compra"
                    checked={todosElegidos}
                    onChange={() => setSeleccion(todosElegidos ? new Set() : new Set(sinCompra.map((l) => l.id)))}
                  />
                )}
              </th>
              <th>Fecha</th>
              <th>Solicitud</th>
              <th>Solicitó</th>
              <th>Marca</th>
              <th style={{ minWidth: 220 }}>Producto</th>
              <th className="num">Cant.</th>
              <th>Estado</th>
              <th>Compra / Envío</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const etiqueta = atributosLabel(l.variante);
              const compra = l.compraDetalle?.proforma;
              return (
                <tr key={l.id}>
                  <td>
                    {!l.compraDetalleId && (
                      <input
                        type="checkbox"
                        aria-label={`Elegir ${l.variante.product.name} de ${l.solicitud.codigo}`}
                        checked={seleccion.has(l.id)}
                        onChange={() => alternar(l.id)}
                      />
                    )}
                  </td>
                  <td className="cell-muted">{formatFecha(l.solicitud.createdAt)}</td>
                  <td>
                    <Link href={`/dashboard/stock/solicitudes/${l.solicitud.id}`} className="link-button">
                      {l.solicitud.codigo}
                    </Link>
                  </td>
                  <td className="cell-muted">{l.solicitud.creadoPor.nombre}</td>
                  <td className="cell-muted">{l.variante.product.brand?.name ?? "—"}</td>
                  <td className="cell-primary">
                    {l.variante.product.name}
                    {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
                  </td>
                  <td className="num">{l.cantidad}</td>
                  <td>
                    <span className={CLASES_LINEA_SOLICITUD[l.estadoLinea]}>{LABELS_LINEA_SOLICITUD[l.estadoLinea]}</span>
                    {(l.estadoLinea === "COMPRADO" || l.estadoLinea === "RECOGIDO") && (
                      <div className="cell-muted" style={{ fontSize: 12 }}>
                        {l.recogidas ?? 0} de {l.cantidad} recogidas
                      </div>
                    )}
                  </td>
                  <td className="cell-muted">
                    {compra ? (
                      <>
                        <Link href={`/dashboard/proformas/${compra.id}`} className="link-button">
                          {compra.codigo}
                        </Link>
                        {l.compraDetalle?.proveedor ? ` · ${l.compraDetalle.proveedor.nombre}` : ""}
                        <EnviosDeLinea envioItems={l.compraDetalle?.envioItems} />
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {l.compraDetalleId && (
                      <button type="button" className="action-btn" disabled={busyId === l.id} onClick={() => handleSoltar(l)}>
                        Soltar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {creando && (
        <CrearComprasModal
          pedidos={[]}
          solicitudes={lineas.filter((l) => seleccion.has(l.id))}
          onClose={() => setCreando(false)}
          onCreated={() => {
            setCreando(false);
            setSeleccion(new Set());
            router.refresh();
          }}
        />
      )}
    </>
  );
}
