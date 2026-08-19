"use client";

import { useEffect, useState } from "react";
import { ApiError, getAlmacenes, getBrands, getCategories, getProducts, getTraspasosAlmacen } from "../../../../lib/api";
import type { Almacen, Brand, Category, Page, Product, TraspasoAlmacen } from "../../../../lib/types";
import { formatAtributosVisibles } from "../../../../components/proformas/AtributosVisibles";
import { DateRangeDropdown, type DateSelection } from "../../../../components/DateRangeDropdown";
import { ProductoSearchSelect } from "../../../../components/proformas/ProductoSearchSelect";

const PAGE_SIZE = 20;
const TODO_EL_TIEMPO: DateSelection = { label: "Todo el tiempo" };

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-VE", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Qué distingue a esta variante puntual + los atributos heredados de la categoría marcados para
 * mostrarse en proforma — mismo criterio que ProformaDetalleTable/Existencias. */
function atributosLabel(variante: TraspasoAlmacen["variante"]): string | null {
  const opciones = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(variante.product.attributeValues, variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

export default function TraspasosAlmacenPage() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");

  const [traspasosPage, setTraspasosPage] = useState<Page<TraspasoAlmacen> | null>(null);
  const [traspasosAlmacenId, setTraspasosAlmacenId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [productId, setProductId] = useState("");
  const [dateSelection, setDateSelection] = useState<DateSelection>(TODO_EL_TIEMPO);
  const [traspasosPageNum, setTraspasosPageNum] = useState(1);
  const [traspasosLoading, setTraspasosLoading] = useState(true);

  const parentCategories = categories.filter((c) => c.parentId === null);
  const subCategoryIds = categories.filter((c) => c.parentId === categoryId).map((c) => c.id);
  const marcasDisponibles = brands.filter((b) => b.categories.some((bc) => subCategoryIds.includes(bc.categoryId)));

  useEffect(() => {
    getAlmacenes({ pageSize: 200 })
      .then((page) => setAlmacenes(page.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getCategories().then(setCategories).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getBrands().then(setBrands).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (!categoryId) {
      setProducts([]);
      return;
    }
    getProducts({ categoryId, brandId: brandId || undefined, pageSize: 200 })
      .then((page) => setProducts(page.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [categoryId, brandId]);

  useEffect(() => {
    setTraspasosLoading(true);
    getTraspasosAlmacen({
      almacenId: traspasosAlmacenId || undefined,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      productId: productId || undefined,
      fechaDesde: dateSelection.fechaDesde,
      fechaHasta: dateSelection.fechaHasta,
      page: traspasosPageNum,
      pageSize: PAGE_SIZE,
    })
      .then(setTraspasosPage)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setTraspasosLoading(false));
  }, [traspasosAlmacenId, categoryId, brandId, productId, dateSelection, traspasosPageNum]);

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setBrandId("");
    setProductId("");
    setTraspasosPageNum(1);
  }

  function handleBrandChange(value: string) {
    setBrandId(value);
    setProductId("");
    setTraspasosPageNum(1);
  }

  function handleProductChange(value: string) {
    setProductId(value);
    setTraspasosPageNum(1);
  }

  function handleDateApply(selection: DateSelection) {
    setDateSelection(selection);
    setTraspasosPageNum(1);
  }

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
        <div className="filter-field">
          <label className="filter-label">Categoría</label>
          <select className="field" value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
            <option value="">Todas</option>
            {parentCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {categoryId && (
          <div className="filter-field">
            <label className="filter-label">Marca</label>
            <select className="field" value={brandId} onChange={(e) => handleBrandChange(e.target.value)}>
              <option value="">Todas</option>
              {marcasDisponibles.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <DateRangeDropdown onApply={handleDateApply} />
        {categoryId && (
          <div className="filter-field">
            <label className="filter-label">Producto</label>
            <ProductoSearchSelect products={products} value={productId} onChange={handleProductChange} />
          </div>
        )}
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
                <th>Marca</th>
                <th>Producto / Variante</th>
                <th>Origen</th>
                <th>Destino</th>
                <th className="num">Cantidad</th>
                <th>Nota</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {traspasosPage.items.map((t) => {
                const etiqueta = atributosLabel(t.variante);
                return (
                  <tr key={t.id}>
                    <td className="cell-muted">{formatDateTime(t.fecha)}</td>
                    <td className="cell-muted">{t.variante.product.brand?.name ?? "—"}</td>
                    <td className="cell-primary">
                      {t.variante.product.name}
                      {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
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
                );
              })}
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
