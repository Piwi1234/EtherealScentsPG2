"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_ORIGIN, apiDelete, apiGet } from "../../../lib/api";
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
  // Los atributos "con precio propio" (ej. Tamaño) no guardan ProductAttributeValue: su valor
  // vive en las variantes del producto, una por cada combinación creada.
  const fromValues = product.attributeValues.filter((pv) => pv.attributeId === attributeId).map(attributeValueLabel);
  const fromVariants = product.variants.flatMap((variant) =>
    variant.options.filter((o) => o.attributeId === attributeId).map((o) => o.option.value),
  );
  const values = Array.from(new Set([...fromValues, ...fromVariants]));
  return values.length > 0 ? values.join(", ") : "—";
}

type ExtraColumn = { id: string; name: string; type: AttributeType; variantMode: AttributeVariantMode };

// Por defecto se elige la variante de mayor precio (ej. si "Tamaño" tiene 50 ML y 100 ML,
// arranca mostrando la de 100 ML).
function defaultVariantId(product: Product): string | undefined {
  if (product.variants.length === 0) return undefined;
  return product.variants.reduce((best, v) => (v.price > best.price ? v : best), product.variants[0]).id;
}

export default function ProductsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [rootCategoryFilter, setRootCategoryFilter] = useState("");
  const [subCategoryFilter, setSubCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState<Page<Product> | null>(null);
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

  function handleRootCategoryFilterChange(id: string) {
    setRootCategoryFilter(id);
    setSubCategoryFilter("");
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

  useEffect(loadProducts, [effectiveCategoryFilter, brandFilter, debouncedSearch]);

  async function handleDelete(product: Product) {
    if (!confirm(`¿Eliminar el producto "${product.name}"?`)) return;
    try {
      await apiDelete(`/products/${product.id}`);
      loadProducts();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
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
      // Atributos con precio propio (ej. Tamaño): su valor vive en las variantes, no en attributeValues.
      for (const variant of product.variants) {
        for (const o of variant.options) {
          if (o.attribute.showInProductList) {
            map.set(o.attributeId, { id: o.attributeId, name: o.attribute.name, type: o.attribute.type, variantMode: o.attribute.variantMode });
          }
        }
      }
    }
    return Array.from(map.values());
  })();

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
        .map((v) => ({ variantId: v.id, label: v.options.find((o) => o.attributeId === column.id)?.option.value }))
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

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Productos</h1>
        <Link href="/dashboard/products/new" className="button">+ Nuevo producto</Link>
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

      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 200 }}>
          <label>Categoría</label>
          <select className="field" value={rootCategoryFilter} onChange={(e) => handleRootCategoryFilterChange(e.target.value)}>
            <option value="">Todas</option>
            {rootCategoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 200 }}>
          <label>Subcategoría</label>
          <select
            className="field"
            value={subCategoryFilter}
            onChange={(e) => setSubCategoryFilter(e.target.value)}
            disabled={!rootCategoryFilter}
          >
            <option value="">Todas</option>
            {subCategoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 200 }}>
          <label>Marca</label>
          <select className="field" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="">Todas</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 240, flex: 1 }}>
          <label>Buscar (nombre o marca)</label>
          <input
            className="field"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Ej: Galaxy, Samsung..."
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
          <table className="table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>ID Producto</th>
                <th>Marca</th>
                <th>Nombre</th>
                {extraAttributeColumns.map((column) => (
                  <th key={column.id}>{column.name}</th>
                ))}
                <th>Precio de compra</th>
                <th>Utilidad</th>
                <th>Precio $</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((product) => {
                const selectedVariant = getSelectedVariant(product);
                return (
                  <tr key={product.id}>
                    <td>
                      {productImageSrc(product.imageUrl) ? (
                        <img
                          src={productImageSrc(product.imageUrl)!}
                          alt={product.name}
                          style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }}
                        />
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td>{product.productCode}</td>
                    <td>{product.brand?.name ?? "—"}</td>
                    <td>{product.name}</td>
                    {extraAttributeColumns.map((column) => (
                      <td key={column.id}>{renderAttributeCell(product, column)}</td>
                    ))}
                    <td>{selectedVariant ? `$${selectedVariant.purchasePrice}` : `$${product.purchasePrice}`}</td>
                    <td>{selectedVariant ? `$${selectedVariant.utility}` : `$${product.utility}`}</td>
                    <td>
                      {selectedVariant ? (
                        <>
                          ${selectedVariant.price.toFixed(2)}
                          {product.variants.length > 1 && (
                            <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 4 }}>
                              (de {product.variants.length})
                            </span>
                          )}
                        </>
                      ) : (
                        `$${product.price.toFixed(2)}`
                      )}
                    </td>
                    <td>
                      <Link href={`/dashboard/products/${product.id}/edit`} className="link-button">Editar</Link>
                      <button type="button" className="link-button danger" onClick={() => handleDelete(product)}>Eliminar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 0 }}>
            {page.total} producto{page.total === 1 ? "" : "s"} en total.
          </p>
        </>
      )}
    </div>
  );
}
