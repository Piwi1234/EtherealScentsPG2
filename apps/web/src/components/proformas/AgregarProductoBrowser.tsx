"use client";

import { useEffect, useState } from "react";
import { API_ORIGIN, ApiError, addDetalleCompra, addDetalleVenta, apiGet, getPresentaciones } from "../../lib/api";
import type {
  AttributeType,
  AttributeVariantMode,
  Brand,
  Category,
  Page,
  PresentacionVenta,
  Product,
  TipoProforma,
} from "../../lib/types";

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 24;
const FLASH_MS = 2000;

function productImageSrc(imageUrl: string | null): string | null {
  return imageUrl ? `${API_ORIGIN}${imageUrl}` : null;
}

function attributeValueLabel(pv: Product["attributeValues"][number]): string {
  if (pv.option) return pv.option.value;
  if (pv.valueText !== null) return pv.valueText;
  if (pv.valueNumber !== null) return pv.valueNumber;
  if (pv.valueBoolean !== null) return pv.valueBoolean ? "Sí" : "No";
  return "—";
}

function productAttributeCell(product: Product, attributeId: string): string {
  const fromValues = product.attributeValues.filter((pv) => pv.attributeId === attributeId).map(attributeValueLabel);
  const fromVariantValues = product.variantOptionValues
    .filter((v) => v.attributeId === attributeId)
    .map((v) => v.value);
  const values = Array.from(new Set([...fromValues, ...fromVariantValues]));
  return values.length > 0 ? values.join(", ") : "—";
}

type ExtraColumn = { id: string; name: string; type: AttributeType; variantMode: AttributeVariantMode };

// Por defecto se elige la variante de mayor precio (ej. si "Tamaño" tiene 50 ML y 100 ML, arranca
// mostrando — y agregando — la de 100 ML).
function defaultVariantId(product: Product): string | undefined {
  if (product.variants.length === 0) return undefined;
  return product.variants.reduce((best, v) => (v.price > best.price ? v : best), product.variants[0]).id;
}

/**
 * Página completa (no modal, no inline) para elegir qué producto agregar a una proforma — tabla
 * acotada a lo que hace falta para decidir qué agregar: imagen, código, marca, nombre, los
 * atributos marcados `mostrarEnProforma` (con el mismo desplegable inline que ya usa
 * `/dashboard/products` cuando ese atributo tiene precio propio — así se sigue pudiendo elegir la
 * variante exacta), descuento y precio final Bs. Más una columna de Cantidad y un botón "Agregar"
 * por fila, que suma la línea sin salir de la página — así se pueden cargar varios productos
 * seguidos. Mismos filtros en cascada que Productos (categoría → subcategoría → marca → búsqueda);
 * no se cargan productos hasta elegir al menos uno (2000+ productos en catálogo, no tiene sentido
 * traer todo de una).
 */
export function AgregarProductoBrowser({ proformaId, tipo }: { proformaId: string; tipo: TipoProforma }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [rootCategoryId, setRootCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [page, setPage] = useState<Page<Product> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState<Record<string, string>>({});
  const [selectedMultiValueByCell, setSelectedMultiValueByCell] = useState<Record<string, string>>({});
  const [cantidadByProduct, setCantidadByProduct] = useState<Record<string, number>>({});
  // Venta de variantes unidad=ML: se elige una presentación (subvariante) en vez de cantidad+precio
  // libres — ver AgregarProductoBrowser.tsx en el plan de "Variantes fraccionadas por ml".
  const [presentacionesByVariant, setPresentacionesByVariant] = useState<Record<string, PresentacionVenta[]>>({});
  const [presentacionIdByProduct, setPresentacionIdByProduct] = useState<Record<string, string>>({});
  const [numPresentacionesByProduct, setNumPresentacionesByProduct] = useState<Record<string, number>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [addedFlash, setAddedFlash] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  // Solo aplica a VENTA: qué precio del catálogo se manda como precioUnitario de la línea.
  const [precioTipo, setPrecioTipo] = useState<"MAY" | "FINAL">("FINAL");

  const rootCategoryOptions = categories.filter((c) => c.parentId === null);
  const subCategoryOptions = categories.filter((c) => c.parentId === rootCategoryId);
  const effectiveCategoryId = subCategoryId || rootCategoryId;
  const relevantCategoryIdsForBrands = subCategoryId ? [subCategoryId] : subCategoryOptions.map((c) => c.id);
  const availableBrands = effectiveCategoryId
    ? brands.filter((b) => b.categories.some((bc) => relevantCategoryIdsForBrands.includes(bc.categoryId)))
    : [];
  const hasAnyFilter = Boolean(effectiveCategoryId || brandId || debouncedSearch.trim());

  useEffect(() => {
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    apiGet<Brand[]>("/brands").then(setBrands).catch(() => {});
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveCategoryId, brandId, debouncedSearch]);

  useEffect(() => {
    if (!hasAnyFilter) {
      setPage(null);
      return;
    }
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(currentPage), pageSize: String(PAGE_SIZE) });
    if (effectiveCategoryId) params.set("categoryId", effectiveCategoryId);
    if (brandId) params.set("brandId", brandId);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    apiGet<Page<Product>>(`/products?${params.toString()}`)
      .then(setPage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCategoryId, brandId, debouncedSearch, currentPage]);

  function handleRootCategoryChange(id: string) {
    setRootCategoryId(id);
    setSubCategoryId("");
    setBrandId("");
  }

  function handleSubCategoryChange(id: string) {
    setSubCategoryId(id);
    setBrandId("");
  }

  function getSelectedVariant(product: Product) {
    if (product.variants.length === 0) return undefined;
    const selectedId = selectedVariantByProduct[product.id] ?? defaultVariantId(product);
    return product.variants.find((v) => v.id === selectedId) ?? product.variants[0];
  }

  // Trae las presentaciones de cualquier variante unidad=ML que esté seleccionada en la página
  // actual y todavía no esté en caché (lazy — no todas las filas son ML).
  useEffect(() => {
    if (!page || tipo !== "VENTA") return;
    const toFetch = new Set<string>();
    for (const product of page.items) {
      const variant = getSelectedVariant(product);
      if (variant && variant.unidad === "ML" && !presentacionesByVariant[variant.id]) {
        toFetch.add(variant.id);
      }
    }
    toFetch.forEach((varianteId) => {
      getPresentaciones(varianteId).then((list) =>
        setPresentacionesByVariant((prev) => ({ ...prev, [varianteId]: list })),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedVariantByProduct, tipo]);

  function renderAttributeCell(product: Product, column: ExtraColumn) {
    if (column.variantMode === "PRICED_VARIANT") {
      if (product.variants.length === 0) return "—";
      const options = product.variants
        .map((v) => ({ variantId: v.id, label: v.options.find((o) => o.optionValue.attributeId === column.id)?.optionValue.value }))
        .filter((o): o is { variantId: string; label: string } => Boolean(o.label));
      if (options.length === 0) return "—";
      const selected = getSelectedVariant(product);
      return (
        <select
          className="field"
          style={{ minWidth: 110 }}
          value={selected?.id ?? options[0].variantId}
          onChange={(e) => setSelectedVariantByProduct((prev) => ({ ...prev, [product.id]: e.target.value }))}
        >
          {options.map((o) => (
            <option key={o.variantId} value={o.variantId}>{o.label}</option>
          ))}
        </select>
      );
    }

    if (column.variantMode === "MULTI_VALUE") {
      const matches = product.variantOptionValues.filter((v) => v.attributeId === column.id);
      if (matches.length === 0) return "—";
      const cellKey = `${product.id}:${column.id}`;
      const selectedValueId = selectedMultiValueByCell[cellKey] ?? matches[0].id;
      return (
        <select
          className="field"
          style={{ minWidth: 110 }}
          value={selectedValueId}
          onChange={(e) => setSelectedMultiValueByCell((prev) => ({ ...prev, [cellKey]: e.target.value }))}
        >
          {matches.map((v) => (
            <option key={v.id} value={v.id}>{v.value}</option>
          ))}
        </select>
      );
    }

    if (column.type === "SELECT") {
      const matches = product.attributeValues.filter((pv) => pv.attributeId === column.id && pv.optionId);
      if (matches.length === 0) return "—";
      const cellKey = `${product.id}:${column.id}`;
      const selectedOptionId = selectedMultiValueByCell[cellKey] ?? matches[0].optionId!;
      return (
        <select
          className="field"
          style={{ minWidth: 110 }}
          value={selectedOptionId}
          onChange={(e) => setSelectedMultiValueByCell((prev) => ({ ...prev, [cellKey]: e.target.value }))}
        >
          {matches.map((pv) => (
            <option key={pv.optionId} value={pv.optionId!}>{pv.option!.value}</option>
          ))}
        </select>
      );
    }

    return productAttributeCell(product, column.id);
  }

  // Columnas de atributos: solo los marcados `mostrarEnProforma`, y solo los que efectivamente
  // aparecen en los productos listados (evita columnas vacías de otras categorías). El de tipo
  // PRICED_VARIANT (si está marcado) se renderiza como desplegable — es la forma de elegir cuál de
  // las variantes se agrega.
  const atributosProformaColumns: ExtraColumn[] = (() => {
    const map = new Map<string, ExtraColumn>();
    for (const product of page?.items ?? []) {
      for (const pv of product.attributeValues) {
        if (pv.attribute.mostrarEnProforma) {
          map.set(pv.attributeId, { id: pv.attributeId, name: pv.attribute.name, type: pv.attribute.type, variantMode: pv.attribute.variantMode });
        }
      }
      for (const v of product.variantOptionValues) {
        if (v.attribute.mostrarEnProforma) {
          map.set(v.attributeId, { id: v.attributeId, name: v.attribute.name, type: v.attribute.type, variantMode: v.attribute.variantMode });
        }
      }
    }
    return Array.from(map.values());
  })();

  async function handleAgregar(product: Product) {
    const variant = getSelectedVariant(product);
    if (!variant) return;
    setSubmittingId(product.id);
    setRowError((prev) => ({ ...prev, [product.id]: "" }));
    try {
      if (tipo === "VENTA" && variant.unidad === "ML") {
        const presentacionVentaId = presentacionIdByProduct[product.id];
        const numPresentaciones = numPresentacionesByProduct[product.id] ?? 1;
        if (!presentacionVentaId) {
          setRowError((prev) => ({ ...prev, [product.id]: "Elegí una presentación." }));
          setSubmittingId(null);
          return;
        }
        await addDetalleVenta(proformaId, { varianteId: variant.id, presentacionVentaId, numPresentaciones });
      } else if (tipo === "VENTA") {
        const cantidad = cantidadByProduct[product.id] ?? 1;
        const precioUnitario = precioTipo === "MAY" ? variant.wholesalePriceBs : variant.finalPriceBs;
        await addDetalleVenta(proformaId, { varianteId: variant.id, cantidad, precioUnitario });
      } else {
        const cantidad = cantidadByProduct[product.id] ?? 1;
        await addDetalleCompra(proformaId, {
          varianteId: variant.id,
          cantidad,
          precioCompra: Number(variant.purchasePrice),
          costoEnvio: Number(product.category.shippingCost ?? 0),
          costoSeguridad: Number(product.category.securityCost ?? 0),
          costoLogistica: Number(product.category.logisticsCost ?? 0),
        });
      }
      setAddedFlash((prev) => ({ ...prev, [product.id]: true }));
      setTimeout(() => setAddedFlash((prev) => ({ ...prev, [product.id]: false })), FLASH_MS);
      setCantidadByProduct((prev) => ({ ...prev, [product.id]: 1 }));
      setNumPresentacionesByProduct((prev) => ({ ...prev, [product.id]: 1 }));
    } catch (e) {
      setRowError((prev) => ({ ...prev, [product.id]: e instanceof ApiError ? e.message : String(e) }));
    } finally {
      setSubmittingId(null);
    }
  }

  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;

  return (
    <div>
      <div className="filters-bar">
        <div className="filter-field" style={{ minWidth: 200 }}>
          <label className="filter-label">Categoría</label>
          <select className="field" value={rootCategoryId} onChange={(e) => handleRootCategoryChange(e.target.value)}>
            <option value="">Todas</option>
            {rootCategoryOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-field" style={{ minWidth: 200 }}>
          <label className="filter-label">Subcategoría</label>
          <select
            className="field"
            value={subCategoryId}
            onChange={(e) => handleSubCategoryChange(e.target.value)}
            disabled={!rootCategoryId}
          >
            <option value="">Todas</option>
            {subCategoryOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-field" style={{ minWidth: 200 }}>
          <label className="filter-label">Marca</label>
          <select
            className="field"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            disabled={!effectiveCategoryId}
          >
            <option value="">Todas</option>
            {availableBrands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-field" style={{ minWidth: 240, flex: 1 }}>
          <label className="filter-label">Realiza tu búsqueda aquí . . .</label>
          <input
            className="field"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Nombre o código"
          />
        </div>
        {tipo === "VENTA" && (
          <div className="filter-field">
            <label className="filter-label">Precio a enviar a la proforma</label>
            <div className="pill-group">
              <label className="checkbox-row" style={{ cursor: "pointer" }}>
                <input type="radio" name="precioTipo" checked={precioTipo === "FINAL"} onChange={() => setPrecioTipo("FINAL")} />
                Final Bs
              </label>
              <label className="checkbox-row" style={{ cursor: "pointer" }}>
                <input type="radio" name="precioTipo" checked={precioTipo === "MAY"} onChange={() => setPrecioTipo("MAY")} />
                May Bs
              </label>
            </div>
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {!hasAnyFilter && (
        <p className="cell-muted">Elegí una categoría, marca, o buscá por nombre/código para ver productos.</p>
      )}
      {hasAnyFilter && loading && <p className="cell-muted">Buscando...</p>}
      {hasAnyFilter && !loading && page && page.items.length === 0 && (
        <p className="cell-muted">No hay productos con esos filtros.</p>
      )}

      {hasAnyFilter && !loading && page && page.items.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="table table-minimal">
              <thead>
                <tr>
                  <th>Imagen</th>
                  <th>ID Producto</th>
                  <th>Marca</th>
                  <th>Nombre</th>
                  {atributosProformaColumns.map((column) => (
                    <th key={column.id}>{column.name}</th>
                  ))}
                  {tipo === "VENTA" && <th>Presentación</th>}
                  <th className="num">Descuento Bs</th>
                  <th className="num">{tipo === "VENTA" && precioTipo === "MAY" ? "▸ " : ""}May Bs</th>
                  <th className="num">{tipo === "VENTA" && precioTipo === "FINAL" ? "▸ " : ""}Precio Final Bs</th>
                  <th className="num">Cantidad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((product) => {
                  const selectedVariant = getSelectedVariant(product);
                  const priceSource = selectedVariant ?? product;
                  const esVentaMl = tipo === "VENTA" && selectedVariant?.unidad === "ML";
                  const esCompraMl = tipo === "COMPRA" && selectedVariant?.unidad === "ML";
                  const presentacionesDeVariante = selectedVariant ? presentacionesByVariant[selectedVariant.id] ?? [] : [];
                  const presentacionActiva = presentacionesDeVariante.filter((p) => p.activo);
                  const presentacionSeleccionada = presentacionesDeVariante.find(
                    (p) => p.id === presentacionIdByProduct[product.id],
                  );
                  return (
                    <tr key={product.id}>
                      <td>
                        {productImageSrc(selectedVariant?.imageUrl ?? product.imageUrl) ? (
                          <img
                            src={productImageSrc(selectedVariant?.imageUrl ?? product.imageUrl)!}
                            alt={product.name}
                            style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }}
                          />
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                      <td className="cell-code">{product.productCode}</td>
                      <td className="cell-muted">{product.brand?.name ?? "—"}</td>
                      <td className="cell-primary">{product.name}</td>
                      {atributosProformaColumns.map((column) => (
                        <td key={column.id}>{renderAttributeCell(product, column)}</td>
                      ))}
                      {tipo === "VENTA" && (
                        <td>
                          {esVentaMl ? (
                            <select
                              className="field"
                              value={presentacionIdByProduct[product.id] ?? ""}
                              onChange={(e) => setPresentacionIdByProduct((prev) => ({ ...prev, [product.id]: e.target.value }))}
                              style={{ minWidth: 130 }}
                            >
                              <option value="">— Presentación —</option>
                              {presentacionActiva.map((p) => (
                                <option key={p.id} value={p.id}>{p.cantidadMl} ml — Bs {p.precioVentaBs}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="cell-muted">—</span>
                          )}
                        </td>
                      )}
                      <td className="num"><span className="unit">Bs</span> {priceSource.discountBs}</td>
                      <td className={`num${tipo === "VENTA" && precioTipo === "MAY" ? " cell-primary" : ""}`}>
                        {esVentaMl ? "—" : (
                          <>
                            <span className="unit">Bs</span> {priceSource.wholesalePriceBs.toFixed(2)}
                          </>
                        )}
                      </td>
                      <td className={`num${tipo !== "VENTA" || precioTipo === "FINAL" ? " cell-primary" : ""}`}>
                        {esVentaMl ? (
                          presentacionSeleccionada ? (
                            <>
                              <span className="unit">Bs</span> {presentacionSeleccionada.precioVentaBs} c/u
                            </>
                          ) : (
                            "—"
                          )
                        ) : (
                          <>
                            <span className="unit">Bs</span> {priceSource.finalPriceBs.toFixed(2)}
                          </>
                        )}
                      </td>
                      <td className="num">
                        <input
                          className="field"
                          type="number"
                          min={1}
                          value={(esVentaMl ? numPresentacionesByProduct[product.id] : cantidadByProduct[product.id]) ?? 1}
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value, 10) || 1;
                            if (esVentaMl) {
                              setNumPresentacionesByProduct((prev) => ({ ...prev, [product.id]: parsed }));
                            } else {
                              setCantidadByProduct((prev) => ({ ...prev, [product.id]: parsed }));
                            }
                          }}
                          style={{ width: 70, textAlign: "center" }}
                        />
                        {esCompraMl && (
                          <span className="cell-muted" style={{ display: "block", fontSize: 11, marginTop: 2 }}>ml</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => handleAgregar(product)}
                          disabled={submittingId === product.id}
                        >
                          {addedFlash[product.id] ? "Agregada ✓" : submittingId === product.id ? "Agregando..." : "Agregar"}
                        </button>
                        {rowError[product.id] && (
                          <p className="error-text" style={{ fontSize: 12, margin: "4px 0 0" }}>{rowError[product.id]}</p>
                        )}
                      </td>
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
                className={`pagination-btn${currentPage <= 1 ? " disabled" : ""}`}
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ← Anterior
              </button>
              <span className="pagination-info">Página {currentPage} de {totalPages}</span>
              <button
                type="button"
                className={`pagination-btn${currentPage >= totalPages ? " disabled" : ""}`}
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente →
              </button>
            </div>
          )}

          <p style={{ color: "var(--muted)", fontSize: 13 }}>{page.total} producto{page.total === 1 ? "" : "s"} en total.</p>
        </>
      )}
    </div>
  );
}
