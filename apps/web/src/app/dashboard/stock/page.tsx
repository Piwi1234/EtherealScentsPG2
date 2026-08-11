"use client";

import { useEffect, useState } from "react";
import { ApiError, getAlmacenes, getLotesCompra, getStock } from "../../../lib/api";
import type { Almacen, LoteCompraConDetalle, Page, StockRow } from "../../../lib/types";

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-VE", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function StockPage() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [error, setError] = useState("");

  const [stockPage, setStockPage] = useState<Page<StockRow> | null>(null);
  const [stockSearchInput, setStockSearchInput] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockAlmacenId, setStockAlmacenId] = useState("");
  const [stockPageNum, setStockPageNum] = useState(1);
  const [stockLoading, setStockLoading] = useState(true);

  const [lotesPage, setLotesPage] = useState<Page<LoteCompraConDetalle> | null>(null);
  const [lotesAlmacenId, setLotesAlmacenId] = useState("");
  const [lotesVarianteId, setLotesVarianteId] = useState("");
  const [lotesVarianteLabel, setLotesVarianteLabel] = useState("");
  const [lotesPageNum, setLotesPageNum] = useState(1);
  const [lotesLoading, setLotesLoading] = useState(true);

  useEffect(() => {
    getAlmacenes({ pageSize: 200 })
      .then((page) => setAlmacenes(page.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    setStockLoading(true);
    getStock({ almacenId: stockAlmacenId || undefined, search: stockSearch || undefined, page: stockPageNum, pageSize: PAGE_SIZE })
      .then(setStockPage)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setStockLoading(false));
  }, [stockAlmacenId, stockSearch, stockPageNum]);

  useEffect(() => {
    setLotesLoading(true);
    getLotesCompra({
      almacenId: lotesAlmacenId || undefined,
      varianteId: lotesVarianteId || undefined,
      page: lotesPageNum,
      pageSize: PAGE_SIZE,
    })
      .then(setLotesPage)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setLotesLoading(false));
  }, [lotesAlmacenId, lotesVarianteId, lotesPageNum]);

  function handleStockSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStockPageNum(1);
    setStockSearch(stockSearchInput.trim());
  }

  function handleVerLotes(row: StockRow) {
    setLotesVarianteId(row.varianteId);
    setLotesVarianteLabel(`${row.variante.product.name} — ${row.variante.variantCode}`);
    setLotesPageNum(1);
    document.getElementById("historial-lotes")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleQuitarFiltroVariante() {
    setLotesVarianteId("");
    setLotesVarianteLabel("");
    setLotesPageNum(1);
  }

  const stockTotalPages = stockPage ? Math.max(1, Math.ceil(stockPage.total / stockPage.pageSize)) : 1;
  const lotesTotalPages = lotesPage ? Math.max(1, Math.ceil(lotesPage.total / lotesPage.pageSize)) : 1;

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Existencias</h1>
        </div>

        <form onSubmit={handleStockSearchSubmit} className="filters-bar" style={{ marginBottom: 16 }}>
          <div className="filter-field">
            <label className="filter-label">Buscar producto</label>
            <input
              className="field"
              placeholder="Nombre o código"
              value={stockSearchInput}
              onChange={(e) => setStockSearchInput(e.target.value)}
              style={{ maxWidth: 240 }}
            />
          </div>
          <div className="filter-field">
            <label className="filter-label">Almacén</label>
            <select
              className="field"
              value={stockAlmacenId}
              onChange={(e) => {
                setStockAlmacenId(e.target.value);
                setStockPageNum(1);
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
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="action-btn">
              Buscar
            </button>
          </div>
        </form>

        {stockLoading ? (
          <p className="cell-muted">Cargando...</p>
        ) : !stockPage || stockPage.items.length === 0 ? (
          <p>No hay existencias registradas.</p>
        ) : (
          <>
            <table className="table table-minimal">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Variante</th>
                  <th>Almacén</th>
                  <th className="num">Física</th>
                  <th className="num">Reservada</th>
                  <th className="num">Disponible</th>
                  <th>Actualizado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stockPage.items.map((row) => (
                  <tr key={`${row.varianteId}-${row.almacenId}`}>
                    <td className="cell-primary">
                      {row.variante.product.name}
                      <div className="cell-muted">{row.variante.product.productCode}</div>
                    </td>
                    <td>
                      {row.variante.variantCode}
                      {row.variante.isDefault && (
                        <span className="badge badge-muted" style={{ marginLeft: 6 }}>
                          Default
                        </span>
                      )}
                    </td>
                    <td>{row.almacen.nombre}</td>
                    <td className="num">{row.cantidadFisica}</td>
                    <td className="num">{row.cantidadReservada}</td>
                    <td className="num">{row.cantidadFisica - row.cantidadReservada}</td>
                    <td className="cell-muted">{formatDateTime(row.updatedAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="action-btn" onClick={() => handleVerLotes(row)}>
                          Ver lotes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stockTotalPages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  className={`pagination-btn${stockPageNum <= 1 ? " disabled" : ""}`}
                  disabled={stockPageNum <= 1}
                  onClick={() => setStockPageNum((p) => p - 1)}
                >
                  ← Anterior
                </button>
                <span className="pagination-info">
                  Página {stockPageNum} de {stockTotalPages}
                </span>
                <button
                  type="button"
                  className={`pagination-btn${stockPageNum >= stockTotalPages ? " disabled" : ""}`}
                  disabled={stockPageNum >= stockTotalPages}
                  onClick={() => setStockPageNum((p) => p + 1)}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}

        <p className="cell-muted" style={{ marginTop: 16 }}>
          Solo aparecen acá variantes con existencia física mayor a 0 en algún almacén.
        </p>
      </div>

      <div className="card" id="historial-lotes">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Historial de lotes de compra</h2>
        </div>

        <div className="filters-bar" style={{ marginBottom: 16 }}>
          <div className="filter-field">
            <label className="filter-label">Almacén</label>
            <select
              className="field"
              value={lotesAlmacenId}
              onChange={(e) => {
                setLotesAlmacenId(e.target.value);
                setLotesPageNum(1);
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
          {lotesVarianteId && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <span className="badge badge-accent">{lotesVarianteLabel}</span>
              <button type="button" className="link-button" onClick={handleQuitarFiltroVariante}>
                Quitar filtro
              </button>
            </div>
          )}
        </div>

        {lotesLoading ? (
          <p className="cell-muted">Cargando...</p>
        ) : !lotesPage || lotesPage.items.length === 0 ? (
          <p>No hay lotes de compra registrados.</p>
        ) : (
          <>
            <table className="table table-minimal">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto / Variante</th>
                  <th>Almacén</th>
                  <th className="num">Costo unitario</th>
                  <th className="num">Cant. inicial</th>
                  <th className="num">Cant. disponible</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {lotesPage.items.map((lote) => (
                  <tr key={lote.id}>
                    <td className="cell-muted">{formatDate(lote.fecha)}</td>
                    <td className="cell-primary">
                      {lote.variante.product.name}
                      <div className="cell-muted">{lote.variante.variantCode}</div>
                    </td>
                    <td>{lote.almacen.nombre}</td>
                    <td className="num">$ {Number(lote.costoUnitario).toFixed(2)}</td>
                    <td className="num">{lote.cantidadInicial}</td>
                    <td className="num">{lote.cantidadDisponible}</td>
                    <td>
                      <span className={`badge ${lote.cantidadDisponible === 0 ? "badge-muted" : "badge-accent"}`}>
                        {lote.cantidadDisponible === 0 ? "Agotado" : "Disponible"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lotesTotalPages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  className={`pagination-btn${lotesPageNum <= 1 ? " disabled" : ""}`}
                  disabled={lotesPageNum <= 1}
                  onClick={() => setLotesPageNum((p) => p - 1)}
                >
                  ← Anterior
                </button>
                <span className="pagination-info">
                  Página {lotesPageNum} de {lotesTotalPages}
                </span>
                <button
                  type="button"
                  className={`pagination-btn${lotesPageNum >= lotesTotalPages ? " disabled" : ""}`}
                  disabled={lotesPageNum >= lotesTotalPages}
                  onClick={() => setLotesPageNum((p) => p + 1)}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
