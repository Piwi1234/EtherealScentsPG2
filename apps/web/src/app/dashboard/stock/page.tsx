"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  createTraspasoAlmacen,
  getAlmacenes,
  getBrands,
  getCategories,
  getLotesCompra,
  getStock,
  getTraspasosAlmacen,
} from "../../../lib/api";
import type { Almacen, Brand, Category, LoteCompraConDetalle, Page, StockRow, TraspasoAlmacen } from "../../../lib/types";
import { Modal } from "../../../components/Modal";
import { LoteAsignacionTable } from "../../../components/proformas/LoteAsignacionTable";

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-VE", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function StockPage() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [error, setError] = useState("");

  const [stockPage, setStockPage] = useState<Page<StockRow> | null>(null);
  const [stockSearchInput, setStockSearchInput] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockAlmacenId, setStockAlmacenId] = useState("");
  const [stockCategoryId, setStockCategoryId] = useState("");
  const [stockMarcaId, setStockMarcaId] = useState("");
  const [stockPageNum, setStockPageNum] = useState(1);
  const [stockLoading, setStockLoading] = useState(false);

  const parentCategories = categories.filter((c) => c.parentId === null);
  // Marcas enlazadas a alguna subcategoría (hija directa) de la categoría padre elegida — no al padre.
  const subCategoryIds = categories.filter((c) => c.parentId === stockCategoryId).map((c) => c.id);
  const marcasDisponibles = brands.filter((b) => b.categories.some((bc) => subCategoryIds.includes(bc.categoryId)));

  const [lotesPage, setLotesPage] = useState<Page<LoteCompraConDetalle> | null>(null);
  const [lotesAlmacenId, setLotesAlmacenId] = useState("");
  const [lotesEstado, setLotesEstado] = useState<"" | "disponible" | "agotado">("");
  const [lotesVarianteId, setLotesVarianteId] = useState("");
  const [lotesVarianteLabel, setLotesVarianteLabel] = useState("");
  const [lotesPageNum, setLotesPageNum] = useState(1);
  const [lotesLoading, setLotesLoading] = useState(false);
  // El historial es pesado (todos los lotes de todos los productos) — no se trae hasta que el
  // usuario pida ver los lotes de un producto puntual desde "Ver lotes".
  const [lotesCargados, setLotesCargados] = useState(false);

  const [traspasosPage, setTraspasosPage] = useState<Page<TraspasoAlmacen> | null>(null);
  const [traspasosAlmacenId, setTraspasosAlmacenId] = useState("");
  const [traspasosPageNum, setTraspasosPageNum] = useState(1);
  const [traspasosLoading, setTraspasosLoading] = useState(false);
  // Mismo criterio que lotesCargados: no se trae hasta que el usuario lo pide.
  const [traspasosCargados, setTraspasosCargados] = useState(false);

  const [traspasoRow, setTraspasoRow] = useState<StockRow | null>(null);
  const [traspasoDestinoId, setTraspasoDestinoId] = useState("");
  const [traspasoCantidad, setTraspasoCantidad] = useState("");
  const [traspasoLotes, setTraspasoLotes] = useState<{ loteCompraId: string; cantidad: number }[]>([]);
  const [traspasoNota, setTraspasoNota] = useState("");
  const [traspasoError, setTraspasoError] = useState("");
  const [traspasoSubmitting, setTraspasoSubmitting] = useState(false);

  function loadStock() {
    // Sin categoría elegida no cargamos existencias — hay que filtrar primero.
    if (!stockCategoryId) {
      setStockPage(null);
      return;
    }
    setStockLoading(true);
    getStock({
      almacenId: stockAlmacenId || undefined,
      search: stockSearch || undefined,
      categoryId: stockCategoryId,
      brandId: stockMarcaId || undefined,
      page: stockPageNum,
      pageSize: PAGE_SIZE,
    })
      .then(setStockPage)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setStockLoading(false));
  }

  function loadLotes() {
    if (!lotesCargados) return;
    setLotesLoading(true);
    getLotesCompra({
      almacenId: lotesAlmacenId || undefined,
      varianteId: lotesVarianteId || undefined,
      estado: lotesEstado || undefined,
      page: lotesPageNum,
      pageSize: PAGE_SIZE,
    })
      .then(setLotesPage)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setLotesLoading(false));
  }

  function loadTraspasos() {
    if (!traspasosCargados) return;
    setTraspasosLoading(true);
    getTraspasosAlmacen({ almacenId: traspasosAlmacenId || undefined, page: traspasosPageNum, pageSize: PAGE_SIZE })
      .then(setTraspasosPage)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setTraspasosLoading(false));
  }

  useEffect(() => {
    getAlmacenes({ pageSize: 200 })
      .then((page) => setAlmacenes(page.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getCategories()
      .then(setCategories)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getBrands()
      .then(setBrands)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadStock, [stockAlmacenId, stockCategoryId, stockMarcaId, stockSearch, stockPageNum]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadLotes, [lotesCargados, lotesAlmacenId, lotesEstado, lotesVarianteId, lotesPageNum]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadTraspasos, [traspasosCargados, traspasosAlmacenId, traspasosPageNum]);

  function handleStockSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStockPageNum(1);
    setStockSearch(stockSearchInput.trim());
  }

  function handleVerLotes(row: StockRow) {
    setLotesVarianteId(row.varianteId);
    setLotesVarianteLabel(`${row.variante.product.name} — ${row.variante.variantCode}`);
    setLotesPageNum(1);
    setLotesCargados(true);
    document.getElementById("historial-lotes")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleQuitarFiltroVariante() {
    setLotesVarianteId("");
    setLotesVarianteLabel("");
    setLotesPageNum(1);
  }

  const almacenesDestinoDisponibles = almacenes.filter((a) => a.activo && a.id !== traspasoRow?.almacenId);
  const traspasoCantidadNum = Number(traspasoCantidad) || 0;
  const traspasoDisponible = traspasoRow ? traspasoRow.cantidadFisica - traspasoRow.cantidadReservada : 0;
  const traspasoRepartido = traspasoLotes.reduce((sum, l) => sum + l.cantidad, 0);
  const traspasoCuadra = traspasoCantidadNum > 0 && traspasoRepartido === traspasoCantidadNum;

  function openTraspasoModal(row: StockRow) {
    setTraspasoRow(row);
    setTraspasoDestinoId("");
    setTraspasoCantidad("");
    setTraspasoLotes([]);
    setTraspasoNota("");
    setTraspasoError("");
  }

  async function handleConfirmarTraspaso() {
    if (!traspasoRow) return;
    setTraspasoError("");
    if (!traspasoDestinoId) {
      setTraspasoError("Elegí un almacén destino.");
      return;
    }
    if (!traspasoCuadra) {
      setTraspasoError("El reparto de lotes no cuadra con la cantidad a trasladar.");
      return;
    }
    setTraspasoSubmitting(true);
    try {
      await createTraspasoAlmacen({
        varianteId: traspasoRow.varianteId,
        almacenOrigenId: traspasoRow.almacenId,
        almacenDestinoId: traspasoDestinoId,
        lotes: traspasoLotes,
        nota: traspasoNota || undefined,
      });
      setTraspasoRow(null);
      loadStock();
      loadLotes();
      loadTraspasos();
    } catch (e) {
      setTraspasoError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setTraspasoSubmitting(false);
    }
  }

  const stockTotalPages = stockPage ? Math.max(1, Math.ceil(stockPage.total / stockPage.pageSize)) : 1;
  const lotesTotalPages = lotesPage ? Math.max(1, Math.ceil(lotesPage.total / lotesPage.pageSize)) : 1;
  const traspasosTotalPages = traspasosPage ? Math.max(1, Math.ceil(traspasosPage.total / traspasosPage.pageSize)) : 1;

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
            <label className="filter-label">Categoría</label>
            <select
              className="field"
              value={stockCategoryId}
              onChange={(e) => {
                setStockCategoryId(e.target.value);
                setStockMarcaId("");
                setStockPageNum(1);
              }}
            >
              <option value="">Elegí una categoría…</option>
              {parentCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {stockCategoryId && (
            <div className="filter-field">
              <label className="filter-label">Marca</label>
              <select
                className="field"
                value={stockMarcaId}
                onChange={(e) => {
                  setStockMarcaId(e.target.value);
                  setStockPageNum(1);
                }}
              >
                <option value="">Todas</option>
                {marcasDisponibles.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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

        {!stockCategoryId ? (
          <p className="cell-muted">Elegí una categoría arriba para ver las existencias.</p>
        ) : stockLoading ? (
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
                    <td className="num">{row.cantidadFisica}{row.variante.unidad === "ML" ? " ml" : ""}</td>
                    <td className="num">{row.cantidadReservada}{row.variante.unidad === "ML" ? " ml" : ""}</td>
                    <td className="num">
                      {row.cantidadFisica - row.cantidadReservada}
                      {row.variante.unidad === "ML" ? " ml" : ""}
                    </td>
                    <td className="cell-muted">{formatDateTime(row.updatedAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="action-btn" onClick={() => handleVerLotes(row)}>
                          Ver lotes
                        </button>
                        <button type="button" className="action-btn" onClick={() => openTraspasoModal(row)}>
                          Trasladar
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
          <div className="filter-field">
            <label className="filter-label">Estado</label>
            <select
              className="field"
              value={lotesEstado}
              onChange={(e) => {
                setLotesEstado(e.target.value as "" | "disponible" | "agotado");
                setLotesPageNum(1);
              }}
            >
              <option value="">Todos</option>
              <option value="disponible">Disponibles</option>
              <option value="agotado">Agotados</option>
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

        {!lotesCargados ? (
          <p className="cell-muted">Elegí &quot;Ver lotes&quot; en un producto de Existencias, arriba, para ver su historial.</p>
        ) : lotesLoading ? (
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
                  <th className="num">Costo unitario Bs</th>
                  <th className="num">TC</th>
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
                    <td className="num">
                      {lote.proformaDetalle.proforma.tipoCambioProf
                        ? `Bs ${(Number(lote.costoUnitario) * Number(lote.proformaDetalle.proforma.tipoCambioProf)).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="num">
                      {lote.proformaDetalle.proforma.tipoCambioProf
                        ? Number(lote.proformaDetalle.proforma.tipoCambioProf).toFixed(2)
                        : "—"}
                    </td>
                    <td className="num">{lote.cantidadInicial}{lote.variante.unidad === "ML" ? " ml" : ""}</td>
                    <td className="num">{lote.cantidadDisponible}{lote.variante.unidad === "ML" ? " ml" : ""}</td>
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

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Historial de traspasos entre almacenes</h2>
        </div>

        {!traspasosCargados ? (
          <button type="button" className="action-btn" onClick={() => setTraspasosCargados(true)}>
            Cargar historial
          </button>
        ) : (
          <>
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
          </>
        )}
      </div>

      {traspasoRow && (
        <Modal
          title={`Trasladar ${traspasoRow.variante.product.name} — ${traspasoRow.variante.variantCode}`}
          onClose={() => setTraspasoRow(null)}
        >
          <div className="form-grid">
            <div>
              <label>Desde</label>
              <input className="field" value={traspasoRow.almacen.nombre} disabled />
            </div>
            <div>
              <label>Hacia</label>
              <select className="field" value={traspasoDestinoId} onChange={(e) => setTraspasoDestinoId(e.target.value)} required>
                <option value="">— Elegir almacén —</option>
                {almacenesDestinoDisponibles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Cantidad a trasladar {traspasoRow.variante.unidad === "ML" ? "(ml)" : ""}</label>
              <input
                className="field"
                type="number"
                min={1}
                max={traspasoDisponible}
                value={traspasoCantidad}
                onChange={(e) => {
                  setTraspasoCantidad(e.target.value);
                  setTraspasoLotes([]);
                }}
              />
              <p className="cell-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
                Disponible: {traspasoDisponible}
                {traspasoRow.variante.unidad === "ML" ? " ml" : ""}
              </p>
            </div>

            {traspasoCantidadNum > 0 && (
              <LoteAsignacionTable
                key={traspasoCantidadNum}
                varianteId={traspasoRow.varianteId}
                almacenId={traspasoRow.almacenId}
                cantidadRequerida={traspasoCantidadNum}
                nombreProducto={traspasoRow.variante.product.name}
                onChange={setTraspasoLotes}
              />
            )}

            <div>
              <label>Nota (opcional)</label>
              <input className="field" value={traspasoNota} onChange={(e) => setTraspasoNota(e.target.value)} />
            </div>

            {traspasoError && <p className="error-text">{traspasoError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setTraspasoRow(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="button"
                disabled={traspasoSubmitting || !traspasoDestinoId || !traspasoCuadra}
                onClick={handleConfirmarTraspaso}
              >
                {traspasoSubmitting ? "Trasladando..." : "Confirmar traslado"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
