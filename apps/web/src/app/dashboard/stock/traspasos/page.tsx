"use client";

import { useEffect, useState } from "react";
import { ApiError, getAlmacenes, getTraspasosAlmacen } from "../../../../lib/api";
import type { Almacen, Page, TraspasoAlmacen } from "../../../../lib/types";

const PAGE_SIZE = 20;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-VE", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TraspasosAlmacenPage() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [error, setError] = useState("");

  const [traspasosPage, setTraspasosPage] = useState<Page<TraspasoAlmacen> | null>(null);
  const [traspasosAlmacenId, setTraspasosAlmacenId] = useState("");
  const [traspasosPageNum, setTraspasosPageNum] = useState(1);
  const [traspasosLoading, setTraspasosLoading] = useState(true);

  useEffect(() => {
    getAlmacenes({ pageSize: 200 })
      .then((page) => setAlmacenes(page.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    setTraspasosLoading(true);
    getTraspasosAlmacen({ almacenId: traspasosAlmacenId || undefined, page: traspasosPageNum, pageSize: PAGE_SIZE })
      .then(setTraspasosPage)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setTraspasosLoading(false));
  }, [traspasosAlmacenId, traspasosPageNum]);

  const traspasosTotalPages = traspasosPage ? Math.max(1, Math.ceil(traspasosPage.total / traspasosPage.pageSize)) : 1;

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Traspasos entre almacenes</h1>
      </div>

      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <div className="filter-field">
          <label className="filter-label">Almacén</label>
          <select
            className="field"
            value={traspasosAlmacenId}
            onChange={(e) => {
              setTraspasosAlmacenId(e.target.value);
              setTraspasosPageNum(1);
            }}
          >
            <option value="">Todos</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {traspasosLoading ? (
        <p className="cell-muted">Cargando...</p>
      ) : !traspasosPage || traspasosPage.items.length === 0 ? (
        <p>No hay traspasos registrados.</p>
      ) : (
        <>
          <table className="table table-minimal">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto / Variante</th>
                <th>Origen</th>
                <th>Destino</th>
                <th className="num">Cantidad</th>
                <th>Nota</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {traspasosPage.items.map((t) => (
                <tr key={t.id}>
                  <td className="cell-muted">{formatDateTime(t.fecha)}</td>
                  <td className="cell-primary">
                    {t.variante.product.name}
                    <div className="cell-muted">{t.variante.variantCode}</div>
                  </td>
                  <td>{t.almacenOrigen.nombre}</td>
                  <td>{t.almacenDestino.nombre}</td>
                  <td className="num">
                    {t.cantidad}
                    {t.variante.unidad === "ML" ? " ml" : ""}
                  </td>
                  <td className="cell-muted">{t.nota ?? "—"}</td>
                  <td className="cell-muted">{t.creadoPor.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {traspasosTotalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className={`pagination-btn${traspasosPageNum <= 1 ? " disabled" : ""}`}
                disabled={traspasosPageNum <= 1}
                onClick={() => setTraspasosPageNum((p) => p - 1)}
              >
                ← Anterior
              </button>
              <span className="pagination-info">
                Página {traspasosPageNum} de {traspasosTotalPages}
              </span>
              <button
                type="button"
                className={`pagination-btn${traspasosPageNum >= traspasosTotalPages ? " disabled" : ""}`}
                disabled={traspasosPageNum >= traspasosTotalPages}
                onClick={() => setTraspasosPageNum((p) => p + 1)}
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
