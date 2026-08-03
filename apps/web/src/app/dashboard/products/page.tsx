"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../../lib/api";
import type { Brand, Category, Page, Product } from "../../../lib/types";

function attributeValueLabel(value: Product["attributeValues"][number]): string {
  if (value.option) return value.option.value;
  if (value.valueText !== null) return value.valueText;
  if (value.valueNumber !== null) return value.valueNumber;
  if (value.valueBoolean !== null) return value.valueBoolean ? "Sí" : "No";
  return "—";
}

export default function ProductsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [page, setPage] = useState<Page<Product> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    apiGet<Brand[]>("/brands").then(setBrands).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (categoryId) params.set("categoryId", categoryId);
    if (brandId) params.set("brandId", brandId);
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then(setPage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [categoryId, brandId]);

  return (
    <div className="card">
      <h1 style={{ marginTop: 0, fontSize: 20 }}>Productos</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 200 }}>
          <label>Categoría</label>
          <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 200 }}>
          <label>Marca</label>
          <select className="field" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Todas</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!page && !error && <p>Cargando...</p>}
      {page && page.items.length === 0 && <p>No hay productos con esos filtros.</p>}
      {page && page.items.length > 0 && (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>SKU</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Categoría</th>
                <th>Marca</th>
                <th>Atributos</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.sku}</td>
                  <td>${product.price}</td>
                  <td>{product.stock}</td>
                  <td>{product.category.name}</td>
                  <td>{product.brand?.name ?? "—"}</td>
                  <td>
                    {product.attributeValues.length === 0
                      ? "—"
                      : product.attributeValues
                          .map((value) => `${value.attribute.name}: ${attributeValueLabel(value)}`)
                          .join(" · ")}
                  </td>
                </tr>
              ))}
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
