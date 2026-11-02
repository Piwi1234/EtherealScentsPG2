"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, getPublicCombos } from "../../lib/api";
import type { Category, Combo } from "../../lib/types";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { ComboCard } from "../../components/landing/ComboCard";

/** Todos los combos publicados, filtrables por categoría. */
export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rootId, setRootId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getPublicCombos()
      .then(setCombos)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    apiGet<Category[]>("/categories")
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Categoría raíz de cada combo (el combo puede estar en una subcategoría).
  const raizDe = useMemo(() => {
    const porId = new Map(categories.map((c) => [c.id, c]));
    return (categoryId: string) => {
      let cur = porId.get(categoryId);
      while (cur?.parentId) cur = porId.get(cur.parentId);
      return cur ?? null;
    };
  }, [categories]);

  const raices = useMemo(() => {
    const ids = new Set((combos ?? []).map((c) => raizDe(c.categoryId)?.id).filter((id): id is string => Boolean(id)));
    return categories.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [combos, categories, raizDe]);

  const visibles = (combos ?? []).filter((c) => !rootId || raizDe(c.categoryId)?.id === rootId);

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <div className="landing-breadcrumb-bar">
        <div className="landing-container">
          <p className="landing-breadcrumb">
            <Link href="/home">Inicio</Link>
            <span>/</span>
            <span className="landing-breadcrumb-current">Combos</span>
          </p>
        </div>
      </div>

      <section className="landing-category-header">
        <div className="landing-container">
          <h1>Combos</h1>
          <p className="landing-category-lead">Lleva varios productos juntos y ahorra: cada combo trae un descuento sobre la suma de sus precios.</p>
        </div>
      </section>

      {raices.length > 1 && (
        <div className="landing-marcas-nav">
          <div className="landing-container landing-marcas-nav-inner">
            <button type="button" className={`landing-pill${rootId === "" ? " landing-pill-active" : ""}`} onClick={() => setRootId("")}>
              Todos
            </button>
            {raices.map((r) => (
              <button key={r.id} type="button" className={`landing-pill${rootId === r.id ? " landing-pill-active" : ""}`} onClick={() => setRootId(r.id)}>
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="landing-section">
        <div className="landing-container">
          {error && <p className="error-text">{error}</p>}
          {!error && !combos && <p className="landing-empty-note">Cargando...</p>}
          {combos && visibles.length === 0 && <p className="landing-empty-note">Por ahora no hay combos disponibles.</p>}
          <div className="landing-product-grid">
            {visibles.map((combo) => (
              <ComboCard key={combo.id} combo={combo} />
            ))}
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
