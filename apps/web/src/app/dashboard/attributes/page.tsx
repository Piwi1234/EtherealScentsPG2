"use client";

import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../../lib/api";
import type { Attribute, AttributeOption, AttributeType, AttributeVariantMode, Category } from "../../../lib/types";
import { Modal } from "../../../components/Modal";

const TYPE_LABELS: Record<AttributeType, string> = {
  TEXT: "Texto",
  NUMBER: "Número",
  BOOLEAN: "Sí/No",
  SELECT: "Lista",
};

const VARIANT_MODE_LABELS: Record<AttributeVariantMode, string> = {
  NONE: "Normal",
  MULTI_VALUE: "Múltiple (sin precio)",
  PRICED_VARIANT: "Con precio propio",
};

export default function AttributesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rootCategoryId, setRootCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [attributes, setAttributes] = useState<Attribute[] | null>(null);
  const [error, setError] = useState("");

  const rootCategories = categories.filter((cat) => cat.parentId === null);
  const subcategories = categories.filter((cat) => cat.parentId === rootCategoryId);
  // Sin subcategoría elegida, se administran los atributos de la categoría raíz.
  const effectiveCategoryId = subCategoryId || rootCategoryId;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Attribute | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<AttributeType>("TEXT");
  const [variantMode, setVariantMode] = useState<AttributeVariantMode>("NONE");
  const [isFilterable, setIsFilterable] = useState(false);
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState<string[]>([""]);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [optionsFor, setOptionsFor] = useState<Attribute | null>(null);
  const [newOptionValue, setNewOptionValue] = useState("");
  const [optionError, setOptionError] = useState("");

  useEffect(() => {
    apiGet<Category[]>("/categories")
      .then((cats) => {
        setCategories(cats);
        // Guard funcional: si el efecto corre dos veces (React Strict Mode) o el usuario
        // ya eligió una categoría antes de que resuelva, no pisar la selección existente.
        setRootCategoryId((prev) => prev || cats.find((c) => c.parentId === null)?.id || "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  function loadAttributes() {
    if (!effectiveCategoryId) return;
    apiGet<Attribute[]>(`/categories/${effectiveCategoryId}/attributes`)
      .then((attrs) => {
        setAttributes(attrs);
        setOptionsFor((prev) => (prev ? attrs.find((a) => a.id === prev.id) ?? null : null));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    setAttributes(null);
    loadAttributes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCategoryId]);

  function handleRootCategoryChange(id: string) {
    setRootCategoryId(id);
    setSubCategoryId("");
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setType("TEXT");
    setVariantMode("NONE");
    setIsFilterable(false);
    setIsRequired(false);
    setOptions([""]);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(attr: Attribute) {
    setEditing(attr);
    setName(attr.name);
    setType(attr.type);
    setIsFilterable(attr.isFilterable);
    setIsRequired(attr.isRequired);
    setFormError("");
    setModalOpen(true);
  }

  async function handleDelete(attr: Attribute) {
    if (!confirm(`¿Eliminar el atributo "${attr.name}"?`)) return;
    try {
      await apiDelete(`/attributes/${attr.id}`);
      loadAttributes();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      if (editing) {
        await apiPatch(`/attributes/${editing.id}`, { name, isFilterable, isRequired });
      } else {
        const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
        await apiPost(`/categories/${effectiveCategoryId}/attributes`, {
          name,
          type,
          isFilterable,
          isRequired,
          variantMode: type === "SELECT" ? variantMode : undefined,
          options: type === "SELECT" ? cleanOptions : undefined,
        });
      }
      setModalOpen(false);
      loadAttributes();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddOption() {
    if (!optionsFor || !newOptionValue.trim()) return;
    setOptionError("");
    try {
      await apiPost(`/attributes/${optionsFor.id}/options`, { value: newOptionValue.trim() });
      setNewOptionValue("");
      loadAttributes();
    } catch (e) {
      setOptionError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  async function handleEditOption(option: AttributeOption) {
    const value = prompt("Nuevo valor:", option.value);
    if (!value || !optionsFor) return;
    try {
      await apiPatch(`/attributes/${optionsFor.id}/options/${option.id}`, { value: value.trim() });
      loadAttributes();
    } catch (e) {
      setOptionError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteOption(option: AttributeOption) {
    if (!optionsFor || !confirm(`¿Eliminar la opción "${option.value}"?`)) return;
    try {
      await apiDelete(`/attributes/${optionsFor.id}/options/${option.id}`);
      loadAttributes();
    } catch (e) {
      setOptionError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Atributos</h1>
        <button type="button" className="button" onClick={openCreate} disabled={!effectiveCategoryId}>+ Nuevo atributo</button>
      </div>
      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 220 }}>
          <label>Categoría</label>
          <select className="field" value={rootCategoryId} onChange={(e) => handleRootCategoryChange(e.target.value)}>
            {rootCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 220 }}>
          <label>Subcategoría</label>
          <select className="field" value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)}>
            <option value="">— Ninguna (ver la categoría) —</option>
            {subcategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!attributes && !error && <p>Cargando...</p>}
      {attributes && attributes.length === 0 && <p>Esta categoría no tiene atributos definidos.</p>}
      {attributes && attributes.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Variante</th>
              <th>Filtrable</th>
              <th>Requerido</th>
              <th>Origen</th>
              <th>Opciones</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {attributes.map((attr) => (
              <tr key={attr.id}>
                <td>{attr.name}</td>
                <td>{TYPE_LABELS[attr.type]}</td>
                <td>
                  {attr.variantMode === "NONE" ? (
                    "—"
                  ) : (
                    <span className="badge">{VARIANT_MODE_LABELS[attr.variantMode]}</span>
                  )}
                </td>
                <td>{attr.isFilterable ? "Sí" : "No"}</td>
                <td>{attr.isRequired ? "Sí" : "No"}</td>
                <td>
                  <span className={`badge${attr.inherited ? " badge-muted" : ""}`}>
                    {attr.inherited ? "Heredado" : "Propio"}
                  </span>
                </td>
                <td>{attr.options.length > 0 ? attr.options.map((o) => o.value).join(", ") : "—"}</td>
                <td>
                  {!attr.inherited && (
                    <>
                      {attr.type === "SELECT" && (
                        <button type="button" className="link-button" onClick={() => { setOptionsFor(attr); setOptionError(""); }}>
                          Opciones
                        </button>
                      )}
                      <button type="button" className="link-button" onClick={() => openEdit(attr)}>Editar</button>
                      <button type="button" className="link-button danger" onClick={() => handleDelete(attr)}>Eliminar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <Modal title={editing ? "Editar atributo" : "Nuevo atributo"} onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label>Nombre</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {!editing && (
              <div>
                <label>Tipo</label>
                <select
                  className="field"
                  value={type}
                  onChange={(e) => {
                    const nextType = e.target.value as AttributeType;
                    setType(nextType);
                    if (nextType !== "SELECT") setVariantMode("NONE");
                  }}
                >
                  {(Object.keys(TYPE_LABELS) as AttributeType[]).map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            )}
            {!editing && type === "SELECT" && (
              <div>
                <label>Tipo de variante</label>
                <select className="field" value={variantMode} onChange={(e) => setVariantMode(e.target.value as AttributeVariantMode)}>
                  {(Object.keys(VARIANT_MODE_LABELS) as AttributeVariantMode[]).map((mode) => (
                    <option key={mode} value={mode}>{VARIANT_MODE_LABELS[mode]}</option>
                  ))}
                </select>
                {variantMode === "MULTI_VALUE" && (
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>
                    El producto podrá elegir 1 o más de estos valores (ej. sabores). No afecta el precio.
                  </p>
                )}
                {variantMode === "PRICED_VARIANT" && (
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>
                    Cada valor elegido en un producto genera una variante con su propio precio de compra,
                    utilidad e ID de producto (ej. tamaño).
                  </p>
                )}
              </div>
            )}
            <label className="checkbox-row">
              <input type="checkbox" checked={isFilterable} onChange={(e) => setIsFilterable(e.target.checked)} />
              Filtrable en el catálogo
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
              Requerido al cargar un producto
            </label>
            {!editing && type === "SELECT" && (
              <div>
                <label>Opciones</label>
                {options.map((opt, i) => (
                  <div key={i} className="option-row" style={{ marginBottom: 8 }}>
                    <input
                      className="field"
                      value={opt}
                      onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))}
                      placeholder={`Opción ${i + 1}`}
                    />
                    <button
                      type="button"
                      className="link-button danger"
                      onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={options.length === 1}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button type="button" className="link-button" onClick={() => setOptions((prev) => [...prev, ""])}>
                  + Agregar opción
                </button>
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

      {optionsFor && (
        <Modal title={`Opciones de "${optionsFor.name}"`} onClose={() => setOptionsFor(null)}>
          <div className="form-grid">
            {optionsFor.options.map((option) => (
              <div key={option.id} className="option-row">
                <span style={{ flex: 1 }}>{option.value}</span>
                <button type="button" className="link-button" onClick={() => handleEditOption(option)}>Editar</button>
                <button type="button" className="link-button danger" onClick={() => handleDeleteOption(option)}>Eliminar</button>
              </div>
            ))}
            <div className="option-row">
              <input
                className="field"
                value={newOptionValue}
                onChange={(e) => setNewOptionValue(e.target.value)}
                placeholder="Nueva opción"
              />
              <button type="button" className="button" onClick={handleAddOption}>Agregar</button>
            </div>
            {optionError && <p className="error-text">{optionError}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
