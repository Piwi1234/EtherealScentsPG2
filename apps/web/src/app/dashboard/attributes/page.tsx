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

function AttributesTable({
  attributes,
  onEdit,
  onDelete,
  onManageOptions,
}: {
  attributes: Attribute[];
  onEdit: (attr: Attribute) => void;
  onDelete: (attr: Attribute) => void;
  onManageOptions: (attr: Attribute) => void;
}) {
  if (attributes.length === 0) {
    return <p style={{ color: "var(--muted)" }}>Sin atributos definidos.</p>;
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Tipo</th>
          <th>Variante</th>
          <th>Filtrable</th>
          <th>Requerido</th>
          <th>En tabla productos</th>
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
              {attr.variantMode === "NONE" ? "—" : <span className="badge">{VARIANT_MODE_LABELS[attr.variantMode]}</span>}
            </td>
            <td>{attr.isFilterable ? "Sí" : "No"}</td>
            <td>{attr.isRequired ? "Sí" : "No"}</td>
            <td>{attr.showInProductList ? "Sí" : "No"}</td>
            <td>
              {attr.variantMode !== "NONE"
                ? "Se definen por producto"
                : attr.options.length > 0
                  ? attr.options.map((o) => o.value).join(", ")
                  : "—"}
            </td>
            <td>
              {attr.type === "SELECT" && attr.variantMode === "NONE" && (
                <button type="button" className="link-button" onClick={() => onManageOptions(attr)}>Opciones</button>
              )}
              <button type="button" className="link-button" onClick={() => onEdit(attr)}>Editar</button>
              <button type="button" className="link-button danger" onClick={() => onDelete(attr)}>Eliminar</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AttributesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rootCategoryId, setRootCategoryId] = useState("");
  const [attributesByCategory, setAttributesByCategory] = useState<Record<string, Attribute[]>>({});
  const [error, setError] = useState("");

  const rootCategories = categories.filter((cat) => cat.parentId === null);
  const subcategories = categories.filter((cat) => cat.parentId === rootCategoryId);
  const rootCategory = categories.find((cat) => cat.id === rootCategoryId);
  // Categoría raíz elegida + todas sus subcategorías, cada una con su propia sección.
  const sections = rootCategory
    ? [{ ...rootCategory, isRoot: true }, ...subcategories.map((sub) => ({ ...sub, isRoot: false }))]
    : [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Attribute | null>(null);
  const [createForCategoryId, setCreateForCategoryId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AttributeType>("TEXT");
  const [variantMode, setVariantMode] = useState<AttributeVariantMode>("NONE");
  const [isFilterable, setIsFilterable] = useState(false);
  const [isRequired, setIsRequired] = useState(false);
  const [showInProductList, setShowInProductList] = useState(false);
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

  function loadAllSections() {
    if (sections.length === 0) return;
    Promise.all(
      // Sin heredados: los de la categoría padre ya se muestran en su propia sección, arriba.
      sections.map((section) =>
        apiGet<Attribute[]>(`/categories/${section.id}/attributes?includeInherited=false`).then(
          (attrs) => [section.id, attrs] as const,
        ),
      ),
    )
      .then((entries) => {
        setAttributesByCategory(Object.fromEntries(entries));
        setOptionsFor((prev) => {
          if (!prev) return prev;
          const refreshed = entries.flatMap(([, attrs]) => attrs).find((a) => a.id === prev.id);
          return refreshed ?? null;
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    setAttributesByCategory({});
    loadAllSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootCategoryId, categories.length]);

  function handleRootCategoryChange(id: string) {
    setRootCategoryId(id);
  }

  function openCreate(categoryId: string) {
    setEditing(null);
    setCreateForCategoryId(categoryId);
    setName("");
    setType("TEXT");
    setVariantMode("NONE");
    setIsFilterable(false);
    setIsRequired(false);
    setShowInProductList(false);
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
    setShowInProductList(attr.showInProductList);
    setFormError("");
    setModalOpen(true);
  }

  async function handleDelete(attr: Attribute) {
    if (!confirm(`¿Eliminar el atributo "${attr.name}"?`)) return;
    try {
      await apiDelete(`/attributes/${attr.id}`);
      loadAllSections();
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
        await apiPatch(`/attributes/${editing.id}`, { name, isFilterable, isRequired, showInProductList });
      } else {
        const isPlainSelect = type === "SELECT" && variantMode === "NONE";
        const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
        await apiPost(`/categories/${createForCategoryId}/attributes`, {
          name,
          type,
          isFilterable,
          isRequired,
          showInProductList,
          variantMode: type === "SELECT" ? variantMode : undefined,
          // Las opciones solo aplican a atributos normales (sin variante): las de variante cargan
          // sus valores por producto. Hay que omitir el campo (no mandar []), porque el backend
          // valida `options` como mínimo 1 elemento cuando el campo está presente.
          options: isPlainSelect ? cleanOptions : undefined,
        });
      }
      setModalOpen(false);
      loadAllSections();
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
      loadAllSections();
    } catch (e) {
      setOptionError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  async function handleEditOption(option: AttributeOption) {
    const value = prompt("Nuevo valor:", option.value);
    if (!value || !optionsFor) return;
    try {
      await apiPatch(`/attributes/${optionsFor.id}/options/${option.id}`, { value: value.trim() });
      loadAllSections();
    } catch (e) {
      setOptionError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteOption(option: AttributeOption) {
    if (!optionsFor || !confirm(`¿Eliminar la opción "${option.value}"?`)) return;
    try {
      await apiDelete(`/attributes/${optionsFor.id}/options/${option.id}`);
      loadAllSections();
    } catch (e) {
      setOptionError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="card">
      <h1 style={{ marginTop: 0, fontSize: 20 }}>Atributos</h1>
      {error && <p className="error-text">{error}</p>}

      <div style={{ marginBottom: 16, maxWidth: 300 }}>
        <label>Categoría</label>
        <select className="field" value={rootCategoryId} onChange={(e) => handleRootCategoryChange(e.target.value)}>
          {rootCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {sections.map((section, i) => (
        <div
          key={section.id}
          style={{
            borderTop: i === 0 ? "none" : "1px solid var(--line)",
            paddingTop: i === 0 ? 0 : 20,
            marginTop: i === 0 ? 0 : 20,
            paddingLeft: section.isRoot ? 0 : 14,
            borderLeft: section.isRoot ? "none" : "3px solid var(--gold)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>
              {section.name}
              {!section.isRoot && <span className="badge badge-accent" style={{ marginLeft: 8 }}>Subcategoría</span>}
            </h2>
            <button type="button" className="button" onClick={() => openCreate(section.id)}>+ Nuevo atributo</button>
          </div>
          {attributesByCategory[section.id] === undefined ? (
            <p>Cargando...</p>
          ) : (
            <AttributesTable
              attributes={attributesByCategory[section.id]}
              onEdit={openEdit}
              onDelete={handleDelete}
              onManageOptions={(attr) => { setOptionsFor(attr); setOptionError(""); }}
            />
          )}
        </div>
      ))}

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
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={showInProductList}
                onChange={(e) => setShowInProductList(e.target.checked)}
              />
              Mostrar como columna en la tabla de Productos
            </label>
            {!editing && type === "SELECT" && variantMode === "NONE" && (
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
            {!editing && type === "SELECT" && variantMode !== "NONE" && (
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                Los valores se cargan por producto (no acá): cada producto arma su propia lista al editarlo.
              </p>
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
