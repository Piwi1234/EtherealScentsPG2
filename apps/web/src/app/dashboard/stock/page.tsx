"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, convertirEnDecants, convertirEnProbador, createSolicitud, createTraspasoAlmacen, downloadStockExport, downloadStockLotesExport, getAlmacenes, getBrands, getCategories, getDecantDestinos, getLotesCompra, getStockDetalle, getStockResumen } from "../../../lib/api";
import type { Almacen, Brand, Category, LoteCompraConDetalle, Page, ProbadorVariante, StockDetalle, StockResumen, StockResumenRow, StockRow } from "../../../lib/types";
import { ExistenciaPanel } from "../../../components/stock/ExistenciaPanel";
import { productImageSrc } from "../../../lib/catalog-display";
import { ExistenciasLista, type OrdenExistencias } from "../../../components/stock/ExistenciasLista";
import { Modal } from "../../../components/Modal";
import { LoteAsignacionTable } from "../../../components/proformas/LoteAsignacionTable";
import { formatAtributosVisibles } from "../../../components/proformas/AtributosVisibles";

const PAGE_SIZE = 20;

/** Atributos que distinguen esta variante puntual (ej. "Sabor: Menta") + los heredados de la
 * categoría marcados mostrarEnProforma — reemplaza al código de producto en la tabla de Existencias. */
function atributosLabel(row: { variante: StockRow["variante"] }): string | null {
  const opciones = row.variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(row.variante.product.attributeValues, row.variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

/** Sugiere los ml de un frasco a partir de sus atributos (ej. "Tamaño: 100 ML" → 100); vacío si no hay ninguno. */
function mlDelFrasco(variante: StockRow["variante"]): string {
  for (const o of variante.options) {
    const m = o.optionValue.value.match(/(\d+(?:[.,]\d+)?)\s*ml/i);
    if (m) return String(Math.round(Number(m[1].replace(",", "."))));
  }
  return "";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-VE", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function StockPage() {
  const router = useRouter();
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [error, setError] = useState("");

  const [stockPage, setStockPage] = useState<StockResumen | null>(null);
  const [stockEstado, setStockEstado] = useState<"" | "SIN_DISPONIBLE" | "CON_DISPONIBLE">("");
  // Producto abierto en el panel lateral y su detalle.
  const [abierto, setAbierto] = useState<StockResumenRow | null>(null);
  const [detalle, setDetalle] = useState<StockDetalle | null>(null);
  const [detalleCargando, setDetalleCargando] = useState(false);
  const [stockSearchInput, setStockSearchInput] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockAlmacenId, setStockAlmacenId] = useState("");
  const [stockCategoryId, setStockCategoryId] = useState("");
  const [stockMarcaId, setStockMarcaId] = useState("");
  const [stockPageNum, setStockPageNum] = useState(1);
  const [stockOrden, setStockOrden] = useState<OrdenExistencias>({ key: "producto", dir: "asc" });
  const [stockLoading, setStockLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingLotes, setExportingLotes] = useState(false);

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

  const [traspasoRow, setTraspasoRow] = useState<StockRow | null>(null);
  // "Solicitar": crea una solicitud de stock con este producto (se compra desde Seguimiento).
  const [solicitarRow, setSolicitarRow] = useState<StockRow | null>(null);
  const [solicitarCantidad, setSolicitarCantidad] = useState("1");
  const [solicitarNota, setSolicitarNota] = useState("");
  const [solicitarError, setSolicitarError] = useState("");
  const [solicitando, setSolicitando] = useState(false);
  const [traspasoDestinoId, setTraspasoDestinoId] = useState("");
  const [traspasoCantidad, setTraspasoCantidad] = useState("");
  const [traspasoLotes, setTraspasoLotes] = useState<{ loteCompraId: string; cantidad: number }[]>([]);
  const [traspasoNota, setTraspasoNota] = useState("");
  const [traspasoError, setTraspasoError] = useState("");
  const [traspasoSubmitting, setTraspasoSubmitting] = useState(false);

  const [probadorRow, setProbadorRow] = useState<StockRow | null>(null);
  const [probadorCantidad, setProbadorCantidad] = useState("");
  const [probadorLotes, setProbadorLotes] = useState<{ loteCompraId: string; cantidad: number }[]>([]);
  const [probadorNota, setProbadorNota] = useState("");
  const [probadorError, setProbadorError] = useState("");
  const [probadorSubmitting, setProbadorSubmitting] = useState(false);

  // Decants: variantes Decants (ML) del producto abierto, y el modal para convertir frascos en ml.
  const [decantDestinos, setDecantDestinos] = useState<ProbadorVariante[]>([]);
  const [decantRow, setDecantRow] = useState<StockRow | null>(null);
  const [decantDestinoId, setDecantDestinoId] = useState("");
  const [decantFrascos, setDecantFrascos] = useState("");
  const [decantMlPorFrasco, setDecantMlPorFrasco] = useState("");
  const [decantLotes, setDecantLotes] = useState<{ loteCompraId: string; cantidad: number }[]>([]);
  const [decantNota, setDecantNota] = useState("");
  const [decantError, setDecantError] = useState("");
  const [decantSubmitting, setDecantSubmitting] = useState(false);

  function loadStock() {
    setStockLoading(true);
    getStockResumen({
      almacenId: stockAlmacenId || undefined,
      search: stockSearch || undefined,
      categoryId: stockCategoryId || undefined,
      brandId: stockMarcaId || undefined,
      estado: stockEstado || undefined,
      sort: stockOrden.key,
      dir: stockOrden.dir,
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
  useEffect(loadStock, [stockAlmacenId, stockCategoryId, stockMarcaId, stockSearch, stockEstado, stockOrden, stockPageNum]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadLotes, [lotesCargados, lotesAlmacenId, lotesEstado, lotesVarianteId, lotesPageNum]);

  // Búsqueda con debounce: espera a que el usuario deje de tipear antes de disparar el pedido.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setStockSearch(stockSearchInput.trim());
      setStockPageNum(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [stockSearchInput]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadStockExport();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  async function handleExportLotes() {
    setExportingLotes(true);
    try {
      await downloadStockLotesExport();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setExportingLotes(false);
    }
  }

  function cargarDetalle(varianteId: string) {
    setDetalleCargando(true);
    getStockDetalle(varianteId)
      .then(setDetalle)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setDetalleCargando(false));
  }

  function abrirPanel(row: StockResumenRow) {
    setAbierto(row);
    setDetalle(null);
    setDecantDestinos([]);
    cargarDetalle(row.varianteId);
    if (row.variante.unidad === "PZA") {
      getDecantDestinos(row.varianteId)
        .then(setDecantDestinos)
        .catch(() => {});
    }
  }

  function handleVerLotes(row: { varianteId: string; variante: StockRow["variante"] }) {
    setAbierto(null);
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

  function openSolicitarModal(row: StockRow) {
    setSolicitarRow(row);
    setSolicitarCantidad("1");
    setSolicitarNota("");
    setSolicitarError("");
  }

  async function handleSolicitar(e: React.FormEvent) {
    e.preventDefault();
    if (!solicitarRow) return;
    const cantidad = parseInt(solicitarCantidad, 10);
    if (!cantidad || cantidad < 1) {
      setSolicitarError("Ingresá una cantidad mayor a cero.");
      return;
    }
    setSolicitando(true);
    setSolicitarError("");
    try {
      const nueva = await createSolicitud({ nota: solicitarNota.trim() || undefined, lineas: [{ varianteId: solicitarRow.varianteId, cantidad }] });
      router.push(`/dashboard/stock/solicitudes/${nueva.id}`);
    } catch (err) {
      setSolicitarError(err instanceof ApiError ? err.message : String(err));
      setSolicitando(false);
    }
  }

  const probadorCantidadNum = Number(probadorCantidad) || 0;
  const probadorDisponible = probadorRow ? probadorRow.cantidadFisica - probadorRow.cantidadReservada : 0;
  const probadorCuadra = probadorCantidadNum > 0 && probadorLotes.reduce((sum, l) => sum + l.cantidad, 0) === probadorCantidadNum;

  function openProbadorModal(row: StockRow) {
    setProbadorRow(row);
    setProbadorCantidad("");
    setProbadorLotes([]);
    setProbadorNota("");
    setProbadorError("");
  }

  async function handleConfirmarProbador() {
    if (!probadorRow) return;
    setProbadorError("");
    if (!probadorCuadra) {
      setProbadorError("El reparto de lotes no cuadra con la cantidad.");
      return;
    }
    setProbadorSubmitting(true);
    try {
      await convertirEnProbador({
        varianteId: probadorRow.varianteId,
        almacenId: probadorRow.almacenId,
        lotes: probadorLotes,
        nota: probadorNota.trim() || undefined,
      });
      setProbadorRow(null);
      loadStock();
      loadLotes();
      if (abierto) cargarDetalle(abierto.varianteId);
    } catch (e) {
      setProbadorError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setProbadorSubmitting(false);
    }
  }

  const decantFrascosNum = Number(decantFrascos) || 0;
  const decantMlNum = Number(decantMlPorFrasco) || 0;
  const decantDisponible = decantRow ? decantRow.cantidadFisica - decantRow.cantidadReservada : 0;
  const decantCuadra = decantFrascosNum > 0 && decantLotes.reduce((sum, l) => sum + l.cantidad, 0) === decantFrascosNum;

  function openDecantModal(row: StockRow) {
    setDecantRow(row);
    setDecantDestinoId(decantDestinos.length === 1 ? decantDestinos[0].id : "");
    setDecantFrascos("");
    setDecantMlPorFrasco(mlDelFrasco(row.variante));
    setDecantLotes([]);
    setDecantNota("");
    setDecantError("");
  }

  async function handleConfirmarDecant() {
    if (!decantRow) return;
    setDecantError("");
    if (!decantDestinoId) {
      setDecantError("Elige la variante Decants que recibe los ml.");
      return;
    }
    if (decantMlNum < 1) {
      setDecantError("Indica cuántos ml trae cada frasco.");
      return;
    }
    if (!decantCuadra) {
      setDecantError("El reparto de lotes no cuadra con la cantidad de frascos.");
      return;
    }
    setDecantSubmitting(true);
    try {
      await convertirEnDecants({
        varianteOrigenId: decantRow.varianteId,
        varianteId: decantDestinoId,
        almacenId: decantRow.almacenId,
        mlPorFrasco: decantMlNum,
        lotes: decantLotes,
        nota: decantNota.trim() || undefined,
      });
      setDecantRow(null);
      loadStock();
      loadLotes();
      if (abierto) cargarDetalle(abierto.varianteId);
    } catch (e) {
      setDecantError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setDecantSubmitting(false);
    }
  }

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
      if (abierto) cargarDetalle(abierto.varianteId);
    } catch (e) {
      setTraspasoError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setTraspasoSubmitting(false);
    }
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
        <div className="ex-head">
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Existencias</h1>
            <p className="cell-muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              {stockPage ? `${stockPage.indicadores.productos} productos` : "Cargando…"} · {almacenes.filter((a) => a.activo).length} almacenes
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="button"
              onClick={handleExport}
              disabled={exporting}
              style={{ background: "#14805F", borderColor: "#14805F", color: "#ffffff" }}
            >
              {exporting ? "Exportando..." : "Exportar existencias"}
            </button>
            <button
              type="button"
              className="button"
              onClick={handleExportLotes}
              disabled={exportingLotes}
              style={{ background: "#7B1E2B", borderColor: "#7B1E2B", color: "#ffffff" }}
            >
              {exportingLotes ? "Exportando..." : "Exportar por lote"}
            </button>
          </div>
        </div>

        {stockPage && (
          <div className="ex-kpis">
            <div>
              <span>Valor del inventario</span>
              <strong>Bs {stockPage.indicadores.valorBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              <small>{stockPage.indicadores.productos} productos</small>
            </div>
            <div>
              <span>Unidades físicas</span>
              <strong>{stockPage.indicadores.unidadesFisicas}</strong>
              <small className="ex-nota-reservada">{stockPage.indicadores.reservadas} reservadas</small>
            </div>
            <div>
              <span>En tránsito</span>
              <strong>{stockPage.indicadores.enTransito}</strong>
              <small className="ex-nota-transito">en envíos despachados, sin llegar</small>
            </div>
            <div>
              <span>Sin disponible</span>
              <strong>{stockPage.indicadores.sinDisponible}</strong>
              <small>todo reservado o agotado</small>
            </div>
          </div>
        )}

        <ExistenciasLista
          page={stockPage}
          loading={stockLoading}
          almacenes={almacenes}
          categories={categories}
          brands={brands}
          searchInput={stockSearchInput}
          onSearchInput={setStockSearchInput}
          estado={stockEstado}
          onEstado={(v) => {
            setStockEstado(v);
            setStockPageNum(1);
          }}
          almacenId={stockAlmacenId}
          onAlmacen={(id) => {
            setStockAlmacenId(id);
            setStockPageNum(1);
          }}
          categoryId={stockCategoryId}
          onCategory={(id) => {
            setStockCategoryId(id);
            setStockMarcaId("");
            setStockPageNum(1);
          }}
          marcaId={stockMarcaId}
          onMarca={(id) => {
            setStockMarcaId(id);
            setStockPageNum(1);
          }}
          orden={stockOrden}
          onOrden={(o) => {
            setStockOrden(o);
            setStockPageNum(1);
          }}
          abiertoId={abierto?.varianteId ?? null}
          onOpen={abrirPanel}
        />

        {stockPage && stockPage.items.length > 0 && (
          <>
            {stockTotalPages > 1 && (
              <div className="pagination">
                <button type="button" className={`pagination-btn${stockPageNum <= 1 ? " disabled" : ""}`} disabled={stockPageNum <= 1} onClick={() => setStockPageNum((p) => p - 1)}>
                  ← Anterior
                </button>
                <span className="pagination-info">
                  Página {stockPageNum} de {stockTotalPages}
                </span>
                <button type="button" className={`pagination-btn${stockPageNum >= stockTotalPages ? " disabled" : ""}`} disabled={stockPageNum >= stockTotalPages} onClick={() => setStockPageNum((p) => p + 1)}>
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}

        <div className="ex-pie">
          <span className="ex-leyenda">
            <span><i className="ex-dot ex-dot--ok" />Disponible</span>
            <span><i className="ex-dot ex-dot--gold" />Reservado</span>
            <span><i className="ex-dot ex-dot--info" />En tránsito</span>
          </span>
          <span>Haz clic en un producto para ver sus lotes y costos, para qué ventas está reservado y qué viene en camino.</span>
        </div>
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
            <table className="table table-minimal table-compact">
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

      {abierto && (
        <ExistenciaPanel
          titulo={abierto.variante.product.name}
          marca={abierto.variante.product.brand?.name ?? null}
          categoria={abierto.variante.product.category.name}
          atributos={atributosLabel(abierto)}
          imagen={productImageSrc(abierto.variante.product.imageUrl)}
          detalle={detalle}
          cargando={detalleCargando}
          onClose={() => setAbierto(null)}
          onTrasladar={(row) => openTraspasoModal(row)}
          onProbador={(row) => openProbadorModal(row)}
          onDecants={decantDestinos.length > 0 ? (row) => openDecantModal(row) : undefined}
          onSolicitar={() => detalle?.almacenes[0] && openSolicitarModal(detalle.almacenes[0])}
          onVerLotes={() => handleVerLotes(abierto)}
        />
      )}

      {solicitarRow && (
        <Modal title={`Solicitar ${solicitarRow.variante.product.name}`} onClose={() => setSolicitarRow(null)} maxWidth={440}>
          <form className="form-grid" onSubmit={handleSolicitar}>
            <p className="cell-muted" style={{ margin: 0, fontSize: 13 }}>
              Crea una solicitud de stock con este producto. Después se compra desde Seguimiento con "Crear compras".
            </p>
            <div>
              <label>Cantidad</label>
              <input className="field" type="number" min={1} value={solicitarCantidad} onChange={(e) => setSolicitarCantidad(e.target.value)} required />
            </div>
            <div>
              <label>Nota (opcional)</label>
              <input className="field" value={solicitarNota} maxLength={300} onChange={(e) => setSolicitarNota(e.target.value)} placeholder="Ej. reposición de temporada" />
            </div>
            {solicitarError && <p className="error-text">{solicitarError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setSolicitarRow(null)}>
                Cancelar
              </button>
              <button type="submit" className="button" disabled={solicitando}>
                {solicitando ? "Creando..." : "Crear solicitud"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {probadorRow && (
        <Modal title={`Convertir en probador: ${probadorRow.variante.product.name}`} onClose={() => setProbadorRow(null)}>
          <div className="form-grid">
            <p className="cell-muted" style={{ margin: 0, fontSize: 13 }}>
              Saca piezas del stock vendible y las deja como probadores: no se venden ni generan ganancia. Se guarda el costo real de los lotes elegidos y
              queda registrado en Inventario → Probadores.
            </p>
            <div>
              <label>Almacén</label>
              <input className="field" value={probadorRow.almacen.nombre} disabled />
            </div>
            <div>
              <label>Cantidad a convertir {probadorRow.variante.unidad === "ML" ? "(ml)" : ""}</label>
              <input
                className="field"
                type="number"
                min={1}
                max={probadorDisponible}
                value={probadorCantidad}
                onChange={(e) => {
                  setProbadorCantidad(e.target.value);
                  setProbadorLotes([]);
                }}
              />
              <p className="cell-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
                Disponible: {probadorDisponible}
                {probadorRow.variante.unidad === "ML" ? " ml" : ""}
              </p>
            </div>
            {probadorCantidadNum > 0 && (
              <LoteAsignacionTable
                key={probadorCantidadNum}
                varianteId={probadorRow.varianteId}
                almacenId={probadorRow.almacenId}
                cantidadRequerida={probadorCantidadNum}
                nombreProducto={probadorRow.variante.product.name}
                onChange={setProbadorLotes}
              />
            )}
            <div>
              <label>Nota (opcional)</label>
              <input className="field" value={probadorNota} maxLength={300} onChange={(e) => setProbadorNota(e.target.value)} placeholder="Ej. probador para la tienda del centro" />
            </div>
            {probadorError && <p className="error-text">{probadorError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setProbadorRow(null)}>
                Cancelar
              </button>
              <button type="button" className="button" disabled={probadorSubmitting || !probadorCuadra} onClick={handleConfirmarProbador}>
                {probadorSubmitting ? "Convirtiendo..." : "Convertir en probador"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {decantRow && (
        <Modal title={`Convertir en decants: ${decantRow.variante.product.name}`} onClose={() => setDecantRow(null)}>
          <div className="form-grid">
            <p className="cell-muted" style={{ margin: 0, fontSize: 13 }}>
              Saca frascos del stock vendible y suma sus ml a la variante Decants del producto. El costo de cada ml sale del costo real del frasco. Se
              venden después por presentaciones (2, 5, 10 ml...) y queda registrado en Inventario → Decants.
            </p>
            <div className="grid-2">
              <div>
                <label>Almacén</label>
                <input className="field" value={decantRow.almacen.nombre} disabled />
              </div>
              <div>
                <label>Variante Decants (destino)</label>
                <select className="field" value={decantDestinoId} onChange={(e) => setDecantDestinoId(e.target.value)}>
                  <option value="">— Elegir —</option>
                  {decantDestinos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.options.map((o) => o.optionValue.value).join(" · ") || d.variantCode}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div>
                <label>Frascos a convertir</label>
                <input
                  className="field"
                  type="number"
                  min={1}
                  max={decantDisponible}
                  value={decantFrascos}
                  onChange={(e) => {
                    setDecantFrascos(e.target.value);
                    setDecantLotes([]);
                  }}
                />
                <p className="cell-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>Disponibles: {decantDisponible}</p>
              </div>
              <div>
                <label>ml por frasco</label>
                <input className="field" type="number" min={1} value={decantMlPorFrasco} onChange={(e) => setDecantMlPorFrasco(e.target.value)} />
                <p className="cell-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
                  {decantFrascosNum > 0 && decantMlNum > 0 ? `Suma ${decantFrascosNum * decantMlNum} ml` : "Confirma el tamaño del frasco"}
                </p>
              </div>
            </div>
            {decantFrascosNum > 0 && (
              <LoteAsignacionTable
                key={decantFrascosNum}
                varianteId={decantRow.varianteId}
                almacenId={decantRow.almacenId}
                cantidadRequerida={decantFrascosNum}
                nombreProducto={decantRow.variante.product.name}
                onChange={setDecantLotes}
              />
            )}
            <div>
              <label>Nota (opcional)</label>
              <input className="field" value={decantNota} maxLength={300} onChange={(e) => setDecantNota(e.target.value)} placeholder="Ej. decants para la feria" />
            </div>
            {decantError && <p className="error-text">{decantError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setDecantRow(null)}>
                Cancelar
              </button>
              <button type="button" className="button" disabled={decantSubmitting || !decantCuadra} onClick={handleConfirmarDecant}>
                {decantSubmitting ? "Convirtiendo..." : "Convertir en decants"}
              </button>
            </div>
          </div>
        </Modal>
      )}

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
