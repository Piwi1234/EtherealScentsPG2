"use client";

import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../../lib/api";
import type { Attribute, Brand, Category, Page, Product } from "../../../lib/types";
import { Modal } from "../../../components/Modal";

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
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [page, setPage] = useState<Page<Product> | null>(null);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [utility, setUtility] = useState("0");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [attributeDefs, setAttributeDefs] = useState<Attribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadProducts() {
    const params = new URLSearchParams();
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (brandFilter) params.set("brandId", brandFilter);
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then(setPage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    apiGet<Brand[]>("/brands").then(setBrands).catch(() => {});
  }, []);

  useEffect(loadProducts, [categoryFilter, brandFilter]);

  async function loadAttributesFor(id: string): Promise<Attribute[]> {
    if (!id) {
      setAttributeDefs([]);
      return [];
    }
    const attrs = await apiGet<Attribute[]>(`/categories/${id}/attributes`);
    setAttributeDefs(attrs);
    return attrs;
  }

  async function handleCategoryChange(id: string) {
    setCategoryId(id);
    setAttributeValues({});
    await loadAttributesFor(id);
  }

  async function openCreate() {
    setEditing(null);
    setName("");
    setPrice("");
    setStock("0");
    setUtility("0");
    setBrandId("");
    setAttributeValues({});
    const firstCategory = categories[0]?.id ?? "";
    setCategoryId(firstCategory);
    await loadAttributesFor(firstCategory);
    setFormError("");
    setModalOpen(true);
  }

  async function openEdit(product: Product) {
    setEditing(product);
    setName(product.name);
    setPrice(product.price);
    setStock(String(product.stock));
    setUtility(product.utility);
    setBrandId(product.brandId ?? "");
    setCategoryId(product.categoryId);
    await loadAttributesFor(product.categoryId);
    const values: Record<string, string> = {};
    for (const pv of product.attributeValues) {
      if (pv.optionId) values[pv.attributeId] = pv.optionId;
      else if (pv.valueText !== null) values[pv.attributeId] = pv.valueText;
      else if (pv.valueNumber !== null) values[pv.attributeId] = pv.valueNumber;
      else if (pv.valueBoolean !== null) values[pv.attributeId] = String(pv.valueBoolean);
    }
    setAttributeValues(values);
    setFormError("");
    setModalOpen(true);
  }

  async function handleDelete(product: Product) {
    if (!confirm(`¿Eliminar el producto "${product.name}"?`)) return;
    try {
      await apiDelete(`/products/${product.id}`);
      loadProducts();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const missing = attributeDefs.filter((def) => def.isRequired && !attributeValues[def.id]);
    if (missing.length > 0) {
      setFormError(`Falta completar: ${missing.map((m) => m.name).join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      const attributeValuesPayload = attributeDefs
        .filter((def) => attributeValues[def.id])
        .map((def) => {
          const raw = attributeValues[def.id];
          if (def.type === "SELECT") return { attributeId: def.id, optionId: raw };
          if (def.type === "NUMBER") return { attributeId: def.id, valueNumber: Number(raw) };
          if (def.type === "BOOLEAN") return { attributeId: def.id, valueBoolean: raw === "true" };
          return { attributeId: def.id, valueText: raw };
        });

      const payload = {
        name,
        price: Number(price),
        stock: Number(stock || 0),
        utility: Number(utility || 0),
        brandId: brandId || undefined,
        categoryId,
        attributeValues: attributeValuesPayload,
      };

      if (editing) {
        await apiPatch(`/products/${editing.id}`, payload);
      } else {
        await apiPost("/products", payload);
      }
      setModalOpen(false);
      loadProducts();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  // Vista previa en vivo: misma fórmula que calcula el backend (categoría actual + utilidad).
  const selectedCategory = categories.find((cat) => cat.id === categoryId);
  const logisticsCostPreview = Number(selectedCategory?.logisticsCost ?? 0);
  const shippingCostPreview = Number(selectedCategory?.shippingCost ?? 0);
  const securityCostPreview = Number(selectedCategory?.securityCost ?? 0);
  const totalCostPreview = logisticsCostPreview + shippingCostPreview + securityCostPreview + Number(utility || 0);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Productos</h1>
        <button type="button" className="button" onClick={openCreate} disabled={categories.length === 0}>+ Nuevo producto</button>
      </div>
      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 200 }}>
          <label>Categoría</label>
          <select className="field" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((cat) => (
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
      </div>

      {!page && !error && <p>Cargando...</p>}
      {page && page.items.length === 0 && <p>No hay productos con esos filtros.</p>}
      {page && page.items.length > 0 && (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>ID Producto</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Utilidad</th>
                <th>Costo $</th>
                <th>Categoría</th>
                <th>Marca</th>
                <th>Atributos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.productCode}</td>
                  <td>${product.price}</td>
                  <td>{product.stock}</td>
                  <td>${product.utility}</td>
                  <td>${product.totalCost.toFixed(2)}</td>
                  <td>{product.category.name}</td>
                  <td>{product.brand?.name ?? "—"}</td>
                  <td>
                    {product.attributeValues.length === 0
                      ? "—"
                      : product.attributeValues
                          .map((value) => `${value.attribute.name}: ${attributeValueLabel(value)}`)
                          .join(" · ")}
                  </td>
                  <td>
                    <button type="button" className="link-button" onClick={() => openEdit(product)}>Editar</button>
                    <button type="button" className="link-button danger" onClick={() => handleDelete(product)}>Eliminar</button>
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

      {modalOpen && (
        <Modal title={editing ? "Editar producto" : "Nuevo producto"} onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label>Nombre</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {editing && (
              <div>
                <label>ID Producto</label>
                <input className="field" value={editing.productCode} disabled />
              </div>
            )}
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <label>Precio</label>
                <input className="field" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
              <div style={{ flex: 1 }}>
                <label>Stock</label>
                <input className="field" type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Utilidad</label>
                <input className="field" type="number" step="0.01" value={utility} onChange={(e) => setUtility(e.target.value)} />
              </div>
            </div>
            <div>
              <label>Marca</label>
              <select className="field" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                <option value="">— Sin marca —</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Categoría</label>
              <select className="field" value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)} required>
                <option value="">— Elegir —</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {selectedCategory && (
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <label style={{ display: "block", marginBottom: 8 }}>
                  Costos heredados de &quot;{selectedCategory.name}&quot; (solo lectura)
                </label>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)" }}>
                  Logística: ${logisticsCostPreview.toFixed(2)} · Envío: ${shippingCostPreview.toFixed(2)} · Seguridad: $
                  {securityCostPreview.toFixed(2)}
                </p>
                <p style={{ margin: 0, fontWeight: 600 }}>Costo $ total: ${totalCostPreview.toFixed(2)}</p>
              </div>
            )}

            {attributeDefs.length > 0 && (
              <div className="form-grid" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                {attributeDefs.map((def) => (
                  <div key={def.id}>
                    <label>
                      {def.name}{def.isRequired ? " *" : ""}
                      {def.inherited ? <span className="badge badge-muted" style={{ marginLeft: 6 }}>Heredado</span> : null}
                    </label>
                    {def.type === "SELECT" && (
                      <select
                        className="field"
                        value={attributeValues[def.id] ?? ""}
                        onChange={(e) => setAttributeValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                      >
                        <option value="">— Elegir —</option>
                        {def.options.map((opt) => (
                          <option key={opt.id} value={opt.id}>{opt.value}</option>
                        ))}
                      </select>
                    )}
                    {def.type === "BOOLEAN" && (
                      <select
                        className="field"
                        value={attributeValues[def.id] ?? ""}
                        onChange={(e) => setAttributeValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                      >
                        <option value="">— Sin especificar —</option>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    )}
                    {def.type === "NUMBER" && (
                      <input
                        className="field"
                        type="number"
                        value={attributeValues[def.id] ?? ""}
                        onChange={(e) => setAttributeValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                      />
                    )}
                    {def.type === "TEXT" && (
                      <input
                        className="field"
                        value={attributeValues[def.id] ?? ""}
                        onChange={(e) => setAttributeValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {formError && <p className="error-text">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="button" disabled={submitting}>
                {submitting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
