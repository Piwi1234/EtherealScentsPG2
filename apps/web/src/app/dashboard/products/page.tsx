"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_ORIGIN, ApiError, apiDelete, apiGet, apiPatch } from "../../../lib/api";
import { consumeFlashMessage } from "../../../lib/flash";
import type { AttributeType, AttributeVariantMode, Brand, Category, Page, Product, ProductVariant } from "../../../lib/types";

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
  // Los atributos con variante (MULTI_VALUE/PRICED_VARIANT) no guardan ProductAttributeValue: sus
  // valores propios del producto viven en variantOptionValues.
  const fromValues = product.attributeValues.filter((pv) => pv.attributeId === attributeId).map(attributeValueLabel);
  const fromVariantValues = product.variantOptionValues
    .filter((v) => v.attributeId === attributeId)
    .map((v) => v.value);
  const values = Array.from(new Set([...fromValues, ...fromVariantValues]));
  return values.length > 0 ? values.join(", ") : "—";
}

type ExtraColumn = { id: string; name: string; type: AttributeType; variantMode: AttributeVariantMode };

// Por defecto se elige la variante de mayor precio (ej. si "Tamaño" tiene 50 ML y 100 ML,
// arranca mostrando la de 100 ML).
function defaultVariantId(product: Product): string | undefined {
  if (product.variants.length === 0) return undefined;
  return product.variants.reduce((best, v) => (v.price > best.price ? v : best), product.variants[0]).id;
}

const PAGE_SIZE = 15;

export default function ProductsPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [rootCategoryFilter, setRootCategoryFilter] = useState("");
  const [subCategoryFilter, setSubCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState<Page<Product> | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState("");
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  // Selección de variante (por producto) y de valor múltiple (por celda), para los desplegables
  // de la tabla. Es puramente de vista: no se guarda en el backend.
  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState<Record<string, string>>({});
  const [selectedMultiValueByCell, setSelectedMultiValueByCell] = useState<Record<string, string>>({});

  const rootCategoryOptions = categories.filter((cat) => cat.parentId === null);
  const subCategoryOptions = categories.filter((cat) => cat.parentId === rootCategoryFilter);
  const effectiveCategoryFilter = subCategoryFilter || rootCategoryFilter;
  // No se cargan productos hasta que se elija al menos un filtro (evita traer la tabla completa,
  // con sus columnas variables, apenas se entra a la página).
  const hasAnyFilter = Boolean(effectiveCategoryFilter || brandFilter || debouncedSearch.trim());

  // Las marcas solo se asignan a subcategorías (nunca a categorías raíz), así que si todavía no
  // se eligió una subcategoría puntual, se consideran válidas las de cualquier subcategoría de la
  // categoría raíz elegida.
  const relevantCategoryIdsForBrands = subCategoryFilter ? [subCategoryFilter] : subCategoryOptions.map((cat) => cat.id);
  const availableBrands = effectiveCategoryFilter
    ? brands.filter((brand) => brand.categories.some((bc) => relevantCategoryIdsForBrands.includes(bc.categoryId)))
    : [];

  function handleRootCategoryFilterChange(id: string) {
    setRootCategoryFilter(id);
    setSubCategoryFilter("");
    setBrandFilter("");
  }

  function handleSubCategoryFilterChange(id: string) {
    setSubCategoryFilter(id);
    setBrandFilter("");
  }

  function loadProducts() {
    if (!hasAnyFilter) {
      setPage(null);
      return;
    }
    const params = new URLSearchParams();
    if (effectiveCategoryFilter) params.set("categoryId", effectiveCategoryFilter);
    if (brandFilter) params.set("brandId", brandFilter);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    params.set("page", String(pageNumber));
    params.set("pageSize", String(PAGE_SIZE));
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then(setPage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    apiGet<Brand[]>("/brands").then(setBrands).catch(() => {});
  }, []);

  // Mensaje de éxito pendiente de la página de crear/editar (sobrevivió al router.push).
  useEffect(() => {
    const message = consumeFlashMessage();
    if (!message) return;
    setFlashMessage(message);
    const timeout = setTimeout(() => setFlashMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, []);

  // Búsqueda con debounce: espera a que el usuario deje de tipear antes de disparar el pedido.
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Vuelve a la primera página cada vez que cambia un filtro (si no, se podría quedar en una
  // página que ya no existe para el nuevo resultado).
  useEffect(() => {
    setPageNumber(1);
  }, [effectiveCategoryFilter, brandFilter, debouncedSearch]);

  useEffect(loadProducts, [effectiveCategoryFilter, brandFilter, debouncedSearch, pageNumber]);

  async function handleDelete(product: Product) {
    if (!confirm(`¿Eliminar el producto "${product.name}"?`)) return;
    try {
      await apiDelete(`/products/${product.id}`);
      loadProducts();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  /** Control de catálogo de la variante representativa de la fila (la misma que ya se usa para
   * mostrar precio) — para granularidad por variante en productos con precio propio, se edita desde
   * el formulario de producto, no acá. */
  async function handleUpdateDisponible(productId: string, variantId: string, disponible: boolean) {
    try {
      await apiPatch(`/products/${productId}/variants/${variantId}`, { disponible });
      loadProducts();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  // Doble click en la fila abre editar, salvo que el doble click haya sido sobre un control
  // interactivo de la celda (el desplegable de variante, los botones de Editar/Eliminar).
  function handleRowDoubleClick(e: React.MouseEvent<HTMLTableRowElement>, product: Product) {
    if ((e.target as HTMLElement).closest("select, button, a, input")) return;
    router.push(`/dashboard/products/${product.id}/edit`);
  }

  // Columnas extra: atributos marcados "Mostrar en tabla de productos", solo los que
  // efectivamente aparecen en los productos listados (evita columnas vacías de otras categorías).
  const extraAttributeColumns: ExtraColumn[] = (() => {
    const map = new Map<string, ExtraColumn>();
    for (const product of page?.items ?? []) {
      for (const pv of product.attributeValues) {
        if (pv.attribute.showInProductList) {
          map.set(pv.attributeId, { id: pv.attributeId, name: pv.attribute.name, type: pv.attribute.type, variantMode: pv.attribute.variantMode });
        }
      }
      // Atributos con variante (MULTI_VALUE/PRICED_VARIANT): sus valores propios del producto viven
      // en variantOptionValues, no en attributeValues.
      for (const v of product.variantOptionValues) {
        if (v.attribute.showInProductList) {
          map.set(v.attributeId, { id: v.attributeId, name: v.attribute.name, type: v.attribute.type, variantMode: v.attribute.variantMode });
        }
      }
    }
    return Array.from(map.values());
  })();

  const totalPages = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1;

  // Variante actualmente elegida para ese producto (por defecto, la de mayor precio). Se usa tanto
  // para las columnas de atributos con precio propio como para Precio de compra/Utilidad/Precio $.
  function getSelectedVariant(product: Product): ProductVariant | undefined {
    if (product.variants.length === 0) return undefined;
    const selectedId = selectedVariantByProduct[product.id] ?? defaultVariantId(product);
    return product.variants.find((v) => v.id === selectedId) ?? product.variants[0];
  }

  // Columnas de atributo tipo "Lista" (SELECT) se muestran como desplegable: para las de precio
  // propio, eligiendo un valor elige la variante entera (y así también cambia Precio $).
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
      // Con un solo valor posible (ej. Concentración, que no admite elegir más de una opción) no
      // hace falta un desplegable — el select solo tiene sentido cuando hay algo entre qué elegir.
      if (matches.length === 1) return matches[0].option!.value;
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

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Productos</h1>
        <Link href="/dashboard/products/new" className="btn-cta">
          <span className="btn-cta-icon">+</span> Nuevo producto
        </Link>
      </div>
      {flashMessage && (
        <div className="success-banner">
          <span>{flashMessage}</span>
          <button type="button" className="link-button" style={{ margin: 0 }} onClick={() => setFlashMessage(null)}>
            Cerrar
          </button>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}

      <div className="filters-bar">
        <div className="filter-field" style={{ minWidth: 200 }}>
          <label className="filter-label">Categoría</label>
          <select className="field" value={rootCategoryFilter} onChange={(e) => handleRootCategoryFilterChange(e.target.value)}>
            <option value="">Todas</option>
            {rootCategoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-field" style={{ minWidth: 200 }}>
          <label className="filter-label">Subcategoría</label>
          <select
            className="field"
            value={subCategoryFilter}
            onChange={(e) => handleSubCategoryFilterChange(e.target.value)}
            disabled={!rootCategoryFilter}
          >
            <option value="">Todas</option>
            {subCategoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-field" style={{ minWidth: 200 }}>
          <label className="filter-label">Marca</label>
          <select
            className="field"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            disabled={!effectiveCategoryFilter}
          >
            <option value="">Todas</option>
            {availableBrands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
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
            placeholder="Nombre o marca"
          />
        </div>
      </div>

      {!hasAnyFilter && (
        <p style={{ color: "var(--muted)" }}>Elegí una categoría, marca, o buscá por nombre/marca para ver productos.</p>
      )}
      {hasAnyFilter && !page && !error && <p>Cargando...</p>}
      {hasAnyFilter && page && page.items.length === 0 && <p>No hay productos con esos filtros.</p>}
      {page && page.items.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="table table-minimal products-table">
              <thead>
                <tr>
                  <th>Imagen</th>
                  <th>Marca</th>
                  <th style={{ minWidth: 260 }}>Nombre</th>
                  {extraAttributeColumns.map((column) => (
                    <th key={column.id}>{column.name}</th>
                  ))}
                  <th className="num">Compra $</th>
                  <th className="num">Utilidad $</th>
                  <th className="num">Precio $</th>
                  <th className="num col-group-start may-bs-col">May Bs</th>
                  <th className="num">Add May</th>
                  <th className="num">Desc. Bs</th>
                  <th className="num final-bs-col">Final Bs</th>
                  <th>Disponible</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((product) => {
                  const selectedVariant = getSelectedVariant(product);
                  // Product y ProductVariant comparten la misma forma para estos campos de precio,
                  // así que alcanza con elegir la fuente (variante seleccionada o producto base) una vez.
                  const priceSource = selectedVariant ?? product;
                  const variantCount = product.variants.length;
                  return (
                    <tr key={product.id} onDoubleClick={(e) => handleRowDoubleClick(e, product)} style={{ cursor: "pointer" }}>
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
                      <td className="cell-muted">{product.brand?.name ?? "—"}</td>
                      <td className="cell-primary">{product.name}</td>
                      {extraAttributeColumns.map((column) => (
                        <td key={column.id}>{renderAttributeCell(product, column)}</td>
                      ))}
                      <td className="num"><span className="unit">$</span>{priceSource.purchasePrice}</td>
                      <td className="num"><span className="unit">$</span>{priceSource.utility}</td>
                      <td className="num">
                        <span className="unit">$</span>{priceSource.price.toFixed(2)}
                        {variantCount > 1 && <span className="cell-muted" style={{ fontSize: 12, marginLeft: 4 }}>(de {variantCount})</span>}
                      </td>
                      <td className="num col-group-start may-bs-col"><span className="unit">Bs</span> {priceSource.wholesalePriceBs.toFixed(2)}</td>
                      <td className="num">
                        {priceSource.minPriceBs !== null ? (
                          <><span className="unit">Bs</span> {priceSource.minPriceBs}</>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                      <td className="num"><span className="unit">Bs</span> {priceSource.discountBs}</td>
                      <td className="num cell-primary final-bs-col">
                        <span className="unit">Bs</span> {priceSource.finalPriceBs.toFixed(2)}
                      </td>
                      <td>
                        {selectedVariant ? (
                          <select
                            className="field"
                            value={selectedVariant.disponible ? "1" : "0"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleUpdateDisponible(product.id, selectedVariant.id, e.target.value === "1")}
                            style={{ width: 130 }}
                          >
                            <option value="1">Disponible</option>
                            <option value="0">No disponible</option>
                          </select>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link href={`/dashboard/products/${product.id}/edit`} className="action-btn">Editar</Link>
                          <button type="button" className="action-btn danger" onClick={() => handleDelete(product)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 0 }}>
            {page.total} producto{page.total === 1 ? "" : "s"} en total.
          </p>
          {totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className={`pagination-btn${pageNumber <= 1 ? " disabled" : ""}`}
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((p) => p - 1)}
              >
                ← Anterior
              </button>
              <span className="pagination-info">
                Página {pageNumber} de {totalPages}
              </span>
              <button
                type="button"
                className={`pagination-btn${pageNumber >= totalPages ? " disabled" : ""}`}
                disabled={pageNumber >= totalPages}
                onClick={() => setPageNumber((p) => p + 1)}
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
