"use client";

import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../../lib/api";
import type { Brand, Category } from "../../../lib/types";
import { Modal } from "../../../components/Modal";

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [categoryIds, setCategoryIds] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadBrands() {
    apiGet<Brand[]>("/brands")
      .then(setBrands)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    loadBrands();
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setCategoryIds(new Set());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditing(brand);
    setName(brand.name);
    setCategoryIds(new Set(brand.categories.map((c) => c.categoryId)));
    setFormError("");
    setModalOpen(true);
  }

  // Una marca solo se asigna a subcategorías, no a categorías raíz; se agrupan por su categoría padre.
  const parentNameById = new Map(categories.map((cat) => [cat.id, cat.name]));
  const subcategoryGroups = Array.from(
    categories
      .filter((cat) => cat.parentId !== null)
      .reduce<Map<string, Category[]>>((groups, cat) => {
        const parentId = cat.parentId as string;
        const list = groups.get(parentId) ?? [];
        list.push(cat);
        groups.set(parentId, list);
        return groups;
      }, new Map())
      .entries(),
  )
    .map(([parentId, subs]) => ({ parentId, parentName: parentNameById.get(parentId) ?? "Otra", subs }))
    .sort((a, b) => a.parentName.localeCompare(b.parentName));

  function toggleCategory(id: string) {
    setCategoryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDelete(brand: Brand) {
    if (!confirm(`¿Eliminar la marca "${brand.name}"?`)) return;
    try {
      await apiDelete(`/brands/${brand.id}`);
      loadBrands();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const payload = { name, categoryIds: Array.from(categoryIds) };
      if (editing) {
        await apiPatch(`/brands/${editing.id}`, payload);
      } else {
        await apiPost("/brands", payload);
      }
      setModalOpen(false);
      loadBrands();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Marcas</h1>
        <button type="button" className="button" onClick={openCreate}>+ Nueva marca</button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!brands && !error && <p>Cargando...</p>}
      {brands && brands.length === 0 && <p>No hay marcas todavía.</p>}
      {brands && brands.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Subcategorías asignadas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => (
              <tr key={brand.id}>
                <td>{brand.name}</td>
                <td>{brand.slug}</td>
                <td>
                  {brand.categories.length === 0
                    ? "—"
                    : brand.categories.map((c) => (
                        <span key={c.categoryId} className="badge">{c.category.name}</span>
                      ))}
                </td>
                <td>
                  <button type="button" className="link-button" onClick={() => openEdit(brand)}>Editar</button>
                  <button type="button" className="link-button danger" onClick={() => handleDelete(brand)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <Modal title={editing ? "Editar marca" : "Nueva marca"} onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label>Nombre</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label>Subcategorías</label>
              <div className="checkbox-list">
                {subcategoryGroups.length === 0 && (
                  <span style={{ color: "var(--muted)" }}>No hay subcategorías creadas todavía.</span>
                )}
                {subcategoryGroups.map((group) => (
                  <div key={group.parentId} className="checkbox-group">
                    <div className="checkbox-group-title">{group.parentName}</div>
                    <div className="checkbox-group-items">
                      {group.subs.map((cat) => (
                        <label key={cat.id} className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={categoryIds.has(cat.id)}
                            onChange={() => toggleCategory(cat.id)}
                          />
                          {cat.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
