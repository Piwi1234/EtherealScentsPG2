"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../../lib/api";
import type { Brand } from "../../../lib/types";

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Brand[]>("/brands")
      .then(setBrands)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="card">
      <h1 style={{ marginTop: 0, fontSize: 20 }}>Marcas</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {!brands && !error && <p>Cargando...</p>}
      {brands && brands.length === 0 && <p>No hay marcas todavía.</p>}
      {brands && brands.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Categorías asignadas</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
