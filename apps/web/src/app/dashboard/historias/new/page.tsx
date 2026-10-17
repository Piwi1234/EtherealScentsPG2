"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createHistoria } from "../../../../lib/api";
import type { HistoriaCategoria } from "../../../../lib/types";

const CATEGORIAS: { value: HistoriaCategoria; label: string }[] = [
  { value: "CASAS", label: "Casas" },
  { value: "PERFUMISTAS", label: "Perfumistas" },
  { value: "INGREDIENTES", label: "Ingredientes" },
  { value: "FRAGANCIAS", label: "Fragancias" },
  { value: "APRENDE", label: "Aprende" },
];

export default function NewHistoriaPage() {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [categorias, setCategorias] = useState<HistoriaCategoria[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleCategoria(value: HistoriaCategoria) {
    setCategorias((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (categorias.length === 0) {
      setError("Elegí al menos una categoría.");
      return;
    }
    setSubmitting(true);
    try {
      const historia = await createHistoria({ titulo, categorias });
      router.push(`/dashboard/historias/${historia.id}/edit`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h1 style={{ margin: "0 0 16px", fontSize: 20 }}>Nueva historia</h1>
      <form className="form-grid" onSubmit={handleSubmit}>
        <div>
          <label>Título</label>
          <input
            className="field"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: El hombre detrás de las leyendas"
            required
          />
        </div>

        <div>
          <label>Categorías</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
            {CATEGORIAS.map((c) => (
              <label key={c.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={categorias.includes(c.value)} onChange={() => toggleCategoria(c.value)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <p className="cell-muted" style={{ fontSize: 12, margin: 0 }}>
          Después de crearla vas a poder cargar la página principal, agregar bloques, imágenes e
          historias relacionadas.
        </p>

        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <button type="button" className="link-button" onClick={() => router.push("/dashboard/historias")}>
            Cancelar
          </button>
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? "Creando..." : "Crear historia"}
          </button>
        </div>
      </form>
    </div>
  );
}
