"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../../lib/api";
import type { Attribute, Category } from "../../../lib/types";

const TYPE_LABELS: Record<Attribute["type"], string> = {
  TEXT: "Texto",
  NUMBER: "Número",
  BOOLEAN: "Sí/No",
  SELECT: "Lista",
};

export default function AttributesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [attributes, setAttributes] = useState<Attribute[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Category[]>("/categories")
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) setCategoryId(cats[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (!categoryId) return;
    setAttributes(null);
    apiGet<Attribute[]>(`/categories/${categoryId}/attributes`)
      .then(setAttributes)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [categoryId]);

  return (
    <div className="card">
      <h1 style={{ marginTop: 0, fontSize: 20 }}>Atributos</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div style={{ marginBottom: 16 }}>
        <label>Categoría</label>
        <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {!attributes && !error && <p>Cargando...</p>}
      {attributes && attributes.length === 0 && <p>Esta categoría no tiene atributos definidos.</p>}
      {attributes && attributes.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Filtrable</th>
              <th>Requerido</th>
              <th>Origen</th>
              <th>Opciones</th>
            </tr>
          </thead>
          <tbody>
            {attributes.map((attr) => (
              <tr key={attr.id}>
                <td>{attr.name}</td>
                <td>{TYPE_LABELS[attr.type]}</td>
                <td>{attr.isFilterable ? "Sí" : "No"}</td>
                <td>{attr.isRequired ? "Sí" : "No"}</td>
                <td>
                  <span className={`badge${attr.inherited ? " badge-muted" : ""}`}>
                    {attr.inherited ? "Heredado" : "Propio"}
                  </span>
                </td>
                <td>{attr.options.length > 0 ? attr.options.map((o) => o.value).join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
