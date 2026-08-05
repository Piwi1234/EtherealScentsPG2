"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet } from "../../lib/api";
import type { Category, Page, Product, ProductVariant } from "../../lib/types";
import { AtributosVisibles } from "./AtributosVisibles";

const DEBOUNCE_MS = 400;

/**
 * Buscador de productos con filtro por categoría; al elegir un producto muestra sus variantes
 * disponibles (combinación de atributos PRICED_VARIANT, ej. tamaño) para elegir la exacta. Si el
 * producto tiene una sola variante (el caso "simple", sin atributos con precio propio) la elige
 * directo, sin pedir un paso extra.
 */
export function VarianteSelector({
  onSelect,
}: {
  onSelect: (args: { producto: Product; variante: ProductVariant }) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ pageSize: "20" });
      if (search) params.set("search", search);
      if (categoryId) params.set("categoryId", categoryId);
      apiGet<Page<Product>>(`/products?${params.toString()}`)
        .then((page) => setProducts(page.items))
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, categoryId]);

  function handleSelectVariant(producto: Product, variante: ProductVariant) {
    onSelect({ producto, variante });
    setSelectedProduct(null);
    setSearch("");
  }

  return (
    <div>
      <div className="filters-bar">
        <div className="filter-field">
          <label className="filter-label">Buscar producto</label>
          <input
            className="field"
            placeholder="Nombre o código . . ."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-field">
          <label className="filter-label">Categoría</label>
          <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? `— ${c.name}` : c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedProduct && (
        <>
          {loading && <p className="cell-muted">Buscando...</p>}
          {!loading && products && products.length === 0 && <p className="cell-muted">Sin resultados.</p>}
          {!loading && products && products.length > 0 && (
            <div className="variante-selector-list">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="variante-selector-item"
                  onClick={() => {
                    if (p.variants.length === 1) {
                      handleSelectVariant(p, p.variants[0]);
                    } else {
                      setSelectedProduct(p);
                    }
                  }}
                >
                  <span className="cell-primary">{p.name}</span>
                  <span className="cell-muted">{p.category.name}</span>
                  <AtributosVisibles attributeValues={p.attributeValues} />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selectedProduct && (
        <div>
          <button type="button" className="link-button" onClick={() => setSelectedProduct(null)}>
            ← Volver a la búsqueda
          </button>
          <p className="cell-primary" style={{ margin: "8px 0" }}>
            {selectedProduct.name}
          </p>
          <div className="variante-selector-list">
            {selectedProduct.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className="variante-selector-item"
                onClick={() => handleSelectVariant(selectedProduct, v)}
              >
                <span>
                  {v.options.length > 0
                    ? v.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`).join(", ")
                    : "Variante única"}
                </span>
                <span className="cell-muted">Bs {v.finalPriceBs.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
