"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, createSolicitud, getSolicitudes } from "../../../../lib/api";
import type { Page, SolicitudStock } from "../../../../lib/types";
import { CLASES_SOLICITUD, LABELS_SOLICITUD } from "../../../../components/proformas/seguimiento-estados";

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
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
          <div className="table-scroll">
            <table className="table table-minimal table-compact">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Fecha</th>
                  <th>Creada por</th>
                  <th className="num">Productos</th>
                  <th className="num">Unidades</th>
                  <th>Avance</th>
                  <th>Estado</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => {
                  const unidades = s.lineas.reduce((n, l) => n + l.cantidad, 0);
                  const recibidas = s.lineas.filter((l) => l.estadoLinea === "RECIBIDA").reduce((n, l) => n + l.cantidad, 0);
                  const sinCompra = s.lineas.filter((l) => l.estadoLinea === "SIN_COMPRA").reduce((n, l) => n + l.cantidad, 0);
                  return (
                    <tr key={s.id} onClick={() => router.push(`/dashboard/stock/solicitudes/${s.id}`)} style={{ cursor: "pointer" }}>
                      <td className="cell-primary">
                        <Link href={`/dashboard/stock/solicitudes/${s.id}`} className="link-button" onClick={(e) => e.stopPropagation()}>
                          {s.codigo}
                        </Link>
                      </td>
                      <td className="cell-muted">{formatDate(s.createdAt)}</td>
                      <td className="cell-muted">{s.creadoPor.nombre}</td>
                      <td className="num">{s.lineas.length}</td>
                      <td className="num">{unidades}</td>
                      <td className="cell-muted">
                        {s.estadoDerivado === "CANCELADA" ? "—" : `${recibidas} de ${unidades} recibidas${sinCompra > 0 ? ` · ${sinCompra} sin comprar` : ""}`}
                      </td>
                      <td>
                        <span className={CLASES_SOLICITUD[s.estadoDerivado]}>{LABELS_SOLICITUD[s.estadoDerivado]}</span>
                      </td>
                      <td className="cell-muted">{s.nota ?? "—"}</td>
                    </tr>
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
