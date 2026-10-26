"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError, cancelarSolicitud, getSolicitud, removeLineaSolicitud, updateLineaSolicitud, updateSolicitud } from "../../../../../lib/api";
import type { SolicitudLinea, SolicitudStock } from "../../../../../lib/types";
import { Modal } from "../../../../../components/Modal";
import { formatAtributosVisibles } from "../../../../../components/proformas/AtributosVisibles";
import {
  CLASES_LINEA_SOLICITUD,
  CLASES_SOLICITUD,
  LABELS_LINEA_SOLICITUD,
  LABELS_SOLICITUD,
} from "../../../../../components/proformas/seguimiento-estados";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function atributosLabel(variante: SolicitudLinea["variante"]): string | null {
  const opciones = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(variante.product.attributeValues, variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

function CantidadEditable({ linea, onCommit }: { linea: SolicitudLinea; onCommit: (cantidad: number) => void }) {
  const [valor, setValor] = useState(String(linea.cantidad));
  return (
    <input
      className="field"
      type="number"
      min={1}
      value={valor}
      aria-label={`Cantidad de ${linea.variante.product.name}`}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => {
        const n = parseInt(valor, 10);
        if (!n || n < 1) setValor(String(linea.cantidad));
        else if (n !== linea.cantidad) onCommit(n);
      }}
      style={{ width: 80, textAlign: "center" }}
    />
  );
}

export default function SolicitudDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [solicitud, setSolicitud] = useState<SolicitudStock | null>(null);
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);

  const cargar = useCallback(() => {
    return getSolicitud(id)
      .then((s) => {
        setSolicitud(s);
        setNota(s.nota ?? "");
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function accion(fn: () => Promise<SolicitudStock>) {
    setError("");
    try {
      const s = await fn();
      setSolicitud(s);
      setNota(s.nota ?? "");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function handleCancelar() {
    setCancelando(true);
    await accion(() => cancelarSolicitud(id));
    setCancelando(false);
    setConfirmarCancelar(false);
  }

  if (!solicitud) {
    return <div className="card">{error ? <p className="error-text">{error}</p> : <p className="cell-muted">Cargando...</p>}</div>;
  }

  const abierta = solicitud.estado === "ABIERTA";
  const unidades = solicitud.lineas.reduce((n, l) => n + l.cantidad, 0);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Solicitud de stock — {solicitud.codigo}</h1>
          <span className={CLASES_SOLICITUD[solicitud.estadoDerivado]}>{LABELS_SOLICITUD[solicitud.estadoDerivado]}</span>
        </div>
        <Link href="/dashboard/stock/solicitudes" className="link-button">
          Volver
        </Link>
      </div>

      <p className="cell-muted" style={{ margin: "0 0 16px" }}>
        Creada por {solicitud.creadoPor.nombre} el {formatDate(solicitud.createdAt)} · {solicitud.lineas.length} producto
        {solicitud.lineas.length === 1 ? "" : "s"}, {unidades} unidades. Se compra desde{" "}
        <Link href="/dashboard/seguimiento" className="link-button">
          Seguimiento
        </Link>{" "}
        con "Crear compras".
      </p>

      <div className="filters-bar" style={{ marginBottom: 20 }}>
        <div className="filter-field" style={{ minWidth: 320, flex: 1 }}>
          <label className="filter-label">Nota</label>
          <input
            className="field"
            value={nota}
            maxLength={300}
            disabled={!abierta}
            placeholder="Para qué se pide este stock (opcional)"
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => {
              if (abierta && nota.trim() !== (solicitud.nota ?? "")) accion(() => updateSolicitud(id, { nota: nota.trim() }));
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 12px" }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Productos</h2>
        {abierta && (
          <Link href={`/dashboard/stock/solicitudes/${solicitud.id}/agregar`} className="btn-cta">
            <span className="btn-cta-icon">+</span> Agregar producto
          </Link>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {solicitud.lineas.length === 0 ? (
        <p className="cell-muted">Todavía no hay productos en esta solicitud.</p>
      ) : (
        <div className="table-scroll">
          <table className="table table-minimal table-compact">
            <thead>
              <tr>
                <th>Marca</th>
                <th style={{ minWidth: 240 }}>Producto</th>
                <th className="num">Cant.</th>
                <th>Estado</th>
                <th>Compra / Envío</th>
                {abierta && <th></th>}
              </tr>
            </thead>
            <tbody>
              {solicitud.lineas.map((l) => {
                const etiqueta = atributosLabel(l.variante);
                const compra = l.compraDetalle?.proforma;
                const libre = !l.compraDetalleId;
                return (
                  <tr key={l.id}>
                    <td className="cell-muted">{l.variante.product.brand?.name ?? "—"}</td>
                    <td className="cell-primary">
                      {l.variante.product.name}
                      {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
                    </td>
                    <td className="num">
                      {abierta && libre ? (
                        <CantidadEditable key={`${l.id}-${l.cantidad}`} linea={l} onCommit={(c) => accion(() => updateLineaSolicitud(id, l.id, { cantidad: c }))} />
                      ) : (
                        l.cantidad
                      )}
                    </td>
                    <td>
                      <span className={CLASES_LINEA_SOLICITUD[l.estadoLinea]}>{LABELS_LINEA_SOLICITUD[l.estadoLinea]}</span>
                    </td>
                    <td className="cell-muted">
                      {compra ? (
                        <>
                          <Link href={`/dashboard/proformas/${compra.id}`} className="link-button">
                            {compra.codigo}
                          </Link>
                          {l.compraDetalle?.proveedor ? ` · ${l.compraDetalle.proveedor.nombre}` : ""}
                          {compra.envio && (
                            <div style={{ fontSize: 12 }}>
                              Envío{" "}
                              <Link href={`/dashboard/stock/envios/${compra.envio.id}`} className="link-button">
                                {compra.envio.codigo}
                              </Link>
                            </div>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    {abierta && (
                      <td>
                        {libre && (
                          <button type="button" className="action-btn danger" onClick={() => accion(() => removeLineaSolicitud(id, l.id))}>
                            Quitar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {abierta && (
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
          <button type="button" className="action-btn danger" onClick={() => setConfirmarCancelar(true)}>
            Cancelar solicitud
          </button>
        </div>
      )}

      {confirmarCancelar && (
        <Modal title="Cancelar solicitud" onClose={() => setConfirmarCancelar(false)}>
          <p>
            ¿Cancelar la solicitud {solicitud.codigo}? Sus productos dejan de aparecer en Seguimiento. Las compras que ya los cubren siguen su
            curso.
          </p>
          <div className="form-actions">
            <button type="button" className="link-button" onClick={() => setConfirmarCancelar(false)}>
              Volver
            </button>
            <button type="button" className="button" onClick={handleCancelar} disabled={cancelando}>
              {cancelando ? "Cancelando..." : "Cancelar solicitud"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
