"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, getBrands, getCategories, getProducts, getRegistros } from "../../../lib/api";
import type { Brand, Category, Page, Product, RegistroLinea, TipoProforma } from "../../../lib/types";
import { formatAtributosVisibles } from "../../../components/proformas/AtributosVisibles";
import { DateRangeDropdown, type DateSelection } from "../../../components/proformas/DateRangeDropdown";
import { ProductoSearchSelect } from "../../../components/proformas/ProductoSearchSelect";

const PAGE_SIZE = 20;
const TODO_EL_TIEMPO: DateSelection = { label: "Todo el tiempo" };

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function money(value: number | null, prefix = "Bs"): string {
  return value === null ? "—" : `${prefix} ${value.toFixed(2)}`;
}

function atributosLabel(variante: RegistroLinea["variante"]): string | null {
  const opciones = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(variante.product.attributeValues, variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

export default function RegistrosPage() {
  const [tipo, setTipo] = useState<"" | TipoProforma>("");
  const [dateSelection, setDateSelection] = useState<DateSelection>(TODO_EL_TIEMPO);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [productId, setProductId] = useState("");
  const [pageNum, setPageNum] = useState(1);

  const [data, setData] = useState<Page<RegistroLinea> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const parentCategories = categories.filter((c) => c.parentId === null);
  const subCategoryIds = categories.filter((c) => c.parentId === categoryId).map((c) => c.id);
  const marcasDisponibles = brands.filter((b) => b.categories.some((bc) => subCategoryIds.includes(bc.categoryId)));

  useEffect(() => {
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
    if (!tipo) {
      setData(null);
      return;
    }
    setLoading(true);
    getRegistros({
      tipo,
      fechaDesde: dateSelection.fechaDesde,
      fechaHasta: dateSelection.fechaHasta,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      productId: productId || undefined,
      page: pageNum,
      limit: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [tipo, dateSelection, categoryId, brandId, productId, pageNum]);

  function handleTipoChange(value: string) {
    setTipo(value as "" | TipoProforma);
    setPageNum(1);
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setBrandId("");
    setProductId("");
    setPageNum(1);
  }

  function handleBrandChange(value: string) {
    setBrandId(value);
    setProductId("");
    setPageNum(1);
  }

  function handleProductChange(value: string) {
    setProductId(value);
    setPageNum(1);
  }

  function handleDateApply(selection: DateSelection) {
    setDateSelection(selection);
    setPageNum(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

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
        <h1 style={{ margin: 0, fontSize: 20 }}>Registros</h1>
      </div>

      <div className="filters-bar">
        <div className="filter-field">
          <label className="filter-label">Tipo</label>
          <select className="field" value={tipo} onChange={(e) => handleTipoChange(e.target.value)}>
            <option value="">Elegí un tipo…</option>
            <option value="COMPRA">Compra</option>
            <option value="VENTA">Venta</option>
          </select>
        </div>

        {tipo && (
          <>
            <DateRangeDropdown onApply={handleDateApply} />

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

            {categoryId && (
              <div className="filter-field">
                <label className="filter-label">Producto</label>
                <ProductoSearchSelect products={products} value={productId} onChange={handleProductChange} />
              </div>
            )}
          </>
        )}
      </div>

      {!tipo && <p className="cell-muted">Elegí un tipo arriba para ver los registros.</p>}

      {tipo && loading && <p className="cell-muted">Cargando...</p>}

      {tipo && !loading && data && data.items.length === 0 && <p>No hay registros para estos filtros.</p>}

      {tipo && !loading && data && data.items.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="table table-minimal">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proforma</th>
                  <th>Código</th>
                  <th>Marca</th>
                  <th style={{ minWidth: 220 }}>Producto</th>
                  <th className="num">Cant.</th>
                  <th className="num">{tipo === "COMPRA" ? "Costo unitario Bs" : "Precio unitario Bs"}</th>
                  <th className="num">Subtotal Bs</th>
                  {tipo === "COMPRA" && <th>Ciudad de origen</th>}
                </tr>
              </thead>
              <tbody>
                {data.items.map((linea) => {
                  const tipoCambioProf = linea.proforma.tipoCambioProf ? Number(linea.proforma.tipoCambioProf) : null;
                  const costoUnitarioUsd =
                    Number(linea.precioCompra ?? 0) +
                    Number(linea.costoEnvio ?? 0) +
                    Number(linea.costoSeguridad ?? 0) +
                    Number(linea.costoLogistica ?? 0);
                  const unitarioBs =
                    tipo === "COMPRA"
                      ? tipoCambioProf
                        ? costoUnitarioUsd * tipoCambioProf
                        : null
                      : Number(linea.precioUnitario ?? 0);
                  const subtotalBs =
                    tipo === "COMPRA"
                      ? tipoCambioProf
                        ? Number(linea.subtotal) * tipoCambioProf
                        : null
                      : Number(linea.subtotal);
                  const etiqueta = atributosLabel(linea.variante);

                  return (
                    <tr key={linea.id}>
                      <td className="cell-muted">{formatDate(linea.proforma.fecha)}</td>
                      <td>
                        <Link href={`/dashboard/proformas/${linea.proforma.id}`} className="link-button">
                          {linea.proforma.empresa.nombre}
                        </Link>
                      </td>
                      <td className="cell-code">{linea.variante.product.productCode}</td>
                      <td className="cell-muted">{linea.variante.product.brand?.name ?? "—"}</td>
                      <td className="cell-primary">
                        {linea.variante.product.name}
                        {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
                      </td>
                      <td className="num">{linea.cantidad}</td>
                      <td className="num">{money(unitarioBs)}</td>
                      <td className="num cell-primary">{money(subtotalBs)}</td>
                      {tipo === "COMPRA" && <td>{linea.proforma.ciudadProcedencia?.nombre ?? "—"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className={`pagination-btn${pageNum <= 1 ? " disabled" : ""}`}
                disabled={pageNum <= 1}
                onClick={() => setPageNum((p) => p - 1)}
              >
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
