"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, createSolicitud, getSolicitudes } from "../../../../lib/api";
import type { Page, SolicitudLinea, SolicitudStock } from "../../../../lib/types";
import { formatAtributosVisibles } from "../../../../components/proformas/AtributosVisibles";
import { CLASES_LINEA_SOLICITUD, CLASES_SOLICITUD, LABELS_LINEA_SOLICITUD, LABELS_SOLICITUD } from "../../../../components/proformas/seguimiento-estados";

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function atributosLabel(variante: SolicitudLinea["variante"]): string | null {
  const opciones = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(variante.product.attributeValues, variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

/**
 * Solicitudes de stock: pedidos internos de mercadería para inventario (sin venta de por medio). Se
 * compran desde Seguimiento con "Crear compras" y avanzan solas (comprada, en tránsito, recibida).
 */
export default function SolicitudesStockPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<"" | "ABIERTA" | "CERRADA" | "CANCELADA">(() => {
    if (typeof window === "undefined") return "";
    const e = new URLSearchParams(window.location.search).get("estado");
    return e === "ABIERTA" || e === "CERRADA" || e === "CANCELADA" ? e : "";
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [data, setData] = useState<Page<SolicitudStock> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  // Solicitudes abiertas (por id): por defecto todas plegadas, se abren con un clic en su encabezado (igual que Registros).
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  function alternar(id: string) {
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPageNum(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    getSolicitudes({ estado: estado || undefined, search: search || undefined, page: pageNum, limit: PAGE_SIZE })
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [estado, search, pageNum]);

  async function handleNueva() {
    setCreando(true);
    setError("");
    try {
      const s = await createSolicitud({});
      router.push(`/dashboard/stock/solicitudes/${s.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setCreando(false);
    }
  }

  const todasAbiertas = !!data && data.items.length > 0 && data.items.every((s) => abiertas.has(s.id));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>Solicitudes de stock</h1>
          <p className="cell-muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Pedidos de mercadería para inventario. Aparecen en Seguimiento y se compran con "Crear compras".
          </p>
        </div>
        <button type="button" className="btn-cta" onClick={handleNueva} disabled={creando}>
          <span className="btn-cta-icon">+</span> {creando ? "Creando..." : "Nueva solicitud"}
        </button>
      </div>

      <div className="filters-bar">
        <div className="filter-field">
          <label className="filter-label">Estado</label>
          <div className="seg" role="group" aria-label="Estado de la solicitud">
            {(
              [
                ["", "Todas"],
                ["ABIERTA", "Abiertas"],
                ["CERRADA", "Cerradas"],
                ["CANCELADA", "Canceladas"],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                className={estado === valor ? "on" : undefined}
                onClick={() => {
                  setEstado(valor);
                  setPageNum(1);
                }}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-field" style={{ minWidth: 240, flex: 1 }}>
          <label className="filter-label">Código o producto</label>
          <input className="field" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Ej. 4HRNPZW o nombre" />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="cell-muted">Cargando...</p>}
      {!loading && data && data.items.length === 0 && <p>No hay solicitudes con estos filtros.</p>}

      {!loading && data && data.items.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
            <button
              type="button"
              className="link-button"
              onClick={() => setAbiertas(todasAbiertas ? new Set() : new Set(data.items.map((s) => s.id)))}
            >
              {todasAbiertas ? "Contraer todo" : "Expandir todo"}
            </button>
          </div>
          <div className="table-scroll">
            <table className="table table-minimal table-compact">
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>Solicitud / marca</th>
                  <th style={{ minWidth: 220 }}>Detalle / producto</th>
                  <th className="num">Unidades</th>
                  <th>Avance</th>
                  <th>Estado</th>
                  <th>Nota / compra</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => {
                  const unidades = s.lineas.reduce((n, l) => n + l.cantidad, 0);
                  const recibidas = s.lineas.filter((l) => l.estadoLinea === "RECIBIDA").reduce((n, l) => n + l.cantidad, 0);
                  const sinCompra = s.lineas.filter((l) => l.estadoLinea === "SIN_COMPRA").reduce((n, l) => n + l.cantidad, 0);
                  const abierta = abiertas.has(s.id);
                  return (
                    <Fragment key={s.id}>
                      <tr className="reg-group" onClick={() => alternar(s.id)} aria-expanded={abierta}>
                        <td className="reg-group-code">
                          <span className="reg-chevron">{abierta ? "▾" : "▸"}</span>
                          <Link
                            href={`/dashboard/stock/solicitudes/${s.id}`}
                            className="action-btn solicitud-btn"
                            title="Abrir la solicitud"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {s.codigo}
                            <span aria-hidden="true">→</span>
                          </Link>
                        </td>
                        <td className="cell-muted" style={{ fontWeight: 400 }}>
                          {formatDate(s.createdAt)} · {s.creadoPor.nombre}
                          {!abierta && s.lineas.length > 0 && ` · ${s.lineas.length} producto${s.lineas.length === 1 ? "" : "s"}`}
                          {s.lineas.length === 0 && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Sin productos</span>}
                        </td>
                        <td className="num">{unidades}</td>
                        <td className="cell-muted" style={{ fontWeight: 400 }}>
                          {s.estadoDerivado === "CANCELADA" ? "—" : `${recibidas} de ${unidades} recibidas${sinCompra > 0 ? ` · ${sinCompra} sin comprar` : ""}`}
                        </td>
                        <td>
                          <span className={CLASES_SOLICITUD[s.estadoDerivado]}>{LABELS_SOLICITUD[s.estadoDerivado]}</span>
                        </td>
                        <td className="cell-muted" style={{ fontWeight: 400 }}>{s.nota ?? "—"}</td>
                      </tr>
                      {abierta &&
                        s.lineas.map((l) => {
                          const etiqueta = atributosLabel(l.variante);
                          const compra = l.compraDetalle?.proforma;
                          return (
                            <tr key={l.id}>
                              <td className="reg-indent cell-muted">{l.variante.product.brand?.name ?? "—"}</td>
                              <td className="cell-primary">
                                {l.variante.product.name}
                                {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
                              </td>
                              <td className="num">{l.cantidad}</td>
                              <td className="cell-muted">
                                {s.estadoDerivado === "CANCELADA" ? "—" : `${l.cantidadRecibida} de ${l.cantidad} recibidas`}
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
                                  </>
                                ) : (
                                  l.nota ?? "—"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button type="button" className={`pagination-btn${pageNum <= 1 ? " disabled" : ""}`} disabled={pageNum <= 1} onClick={() => setPageNum((p) => p - 1)}>
                ← Anterior
              </button>
              <span className="pagination-info">
                Página {pageNum} de {totalPages}
              </span>
              <button
                type="button"
                className={`pagination-btn${pageNum >= totalPages ? " disabled" : ""}`}
                disabled={pageNum >= totalPages}
                onClick={() => setPageNum((p) => p + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
