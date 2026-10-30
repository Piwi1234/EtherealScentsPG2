"use client";
import { contieneBusqueda } from "../../lib/busqueda";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getHistoriaDestacada, getHistorias } from "../../lib/api";
import { HISTORIA_CATEGORIA_LABELS, historiaImageSrc, historiaParagraphs, renderHistoriaInline } from "../../lib/historia-display";
import type { HistoriaCategoria, HistoriaDetalle, HistoriaResumen } from "../../lib/types";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";

const CATEGORIAS: HistoriaCategoria[] = ["CASAS", "PERFUMISTAS", "INGREDIENTES", "FRAGANCIAS", "APRENDE"];

export default function HistoriasPage() {
  const [historias, setHistorias] = useState<HistoriaResumen[] | null>(null);
  // Independiente del filtro/búsqueda de abajo a propósito: es siempre la misma (la marcada a mano
  // en Gestión, o la más reciente publicada si no hay ninguna marcada) — antes tomaba el primer
  // resultado FILTRADO, así que al elegir una categoría sin esa historia en el tope, la tarjeta
  // "Destacada" desaparecía aunque sí hubiera una destacada real.
  const [destacada, setDestacada] = useState<HistoriaDetalle | null>(null);
  const [error, setError] = useState("");
  const [categoria, setCategoria] = useState<HistoriaCategoria | "">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    getHistorias()
      .then(setHistorias)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getHistoriaDestacada()
      .then(setDestacada)
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!historias) return [];
    const q = search.trim().toLowerCase();
    return historias.filter((h) => {
      if (categoria && !h.categorias.some((c) => c.categoria === categoria)) return false;
      if (q && !contieneBusqueda(h.titulo, q)) return false;
      return true;
    });
  }, [historias, categoria, search]);

  // La destacada no se repite en la grilla de abajo si el filtro actual también la incluye.
  const resto = filtered.filter((h) => h.id !== destacada?.id);

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <div className="landing-breadcrumb-bar">
        <div className="landing-container">
          <p className="landing-breadcrumb">
            <Link href="/home">Inicio</Link>
            <span>/</span>
            <span className="landing-breadcrumb-current">Historias</span>
          </p>
        </div>
      </div>

      <section className="landing-category-header">
        <div className="landing-container">
          <h1>Historias</h1>
          <p className="landing-category-lead">
            Casas, perfumistas, ingredientes y fragancias icónicas: las historias detrás de lo que huele bien.
          </p>
        </div>
      </section>

      {destacada && (
        <section className="landing-section" style={{ paddingBottom: 0 }}>
          <div className="landing-container">
            <div className="landing-historia-split landing-historia-destacada">
              <div className="landing-historia-split-text">
                <div className="landing-historia-eyebrow" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      background: "var(--es-navy-900)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                    }}
                  >
                    DESTACADA
                  </span>
                  <span className="landing-historia-eyebrow-meta">
                    {destacada.categorias.map((c) => HISTORIA_CATEGORIA_LABELS[c.categoria]).join(" · ")}
                  </span>
                </div>
                <h2 className="landing-historia-title" style={{ fontSize: 30 }}>
                  {destacada.bloques[0]?.texto1 || destacada.titulo}
                </h2>
                {destacada.bloques[0]?.texto2 && <p className="landing-historia-name">{destacada.bloques[0].texto2}</p>}
                {destacada.bloques[0]?.texto3 && <p className="landing-historia-tagline">{destacada.bloques[0].texto3}</p>}
                {historiaParagraphs(destacada.bloques[0]?.texto4 ?? null).slice(0, 1).map((p, i) => (
                  <div className="landing-historia-body" key={i}>
                    <p>{renderHistoriaInline(p)}</p>
                  </div>
                ))}
                <Link
                  href={`/historias/${destacada.slug}`}
                  className="landing-btn landing-btn-primary"
                  style={{ width: "fit-content", marginTop: 8 }}
                >
                  Leer la historia
                </Link>
              </div>
              <div className="landing-historia-split-image-wrap">
                {historiaImageSrc(destacada.bloques[0]?.imageUrl ?? null) && (
                  <img
                    className="landing-historia-split-image"
                    src={historiaImageSrc(destacada.bloques[0]?.imageUrl ?? null)!}
                    alt={destacada.titulo}
                  />
                )}
                <div className="landing-historia-split-fade" />
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="landing-section">
        <div className="landing-container">
          <p className="landing-eyebrow">{destacada ? "Todas las historias" : "Historias"}</p>

          {error && <p className="error-text">{error}</p>}
          {!historias && !error && <p className="landing-empty-note">Cargando...</p>}

          <div className="landing-historia-search-wrap">
            <input
              type="search"
              className="landing-historia-search"
              placeholder="Buscar historia por título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="landing-historia-filters">
            <button
              type="button"
              className={`landing-pill${categoria === "" ? " landing-pill-active" : ""}`}
              onClick={() => setCategoria("")}
            >
              Todas
            </button>
            {CATEGORIAS.map((c) => (
              <button
                key={c}
                type="button"
                className={`landing-pill${categoria === c ? " landing-pill-active" : ""}`}
                onClick={() => setCategoria(c)}
              >
                {HISTORIA_CATEGORIA_LABELS[c]}
              </button>
            ))}
          </div>

          {historias && filtered.length === 0 && (
            <p className="landing-empty-note">
              {search ? `No hay historias que coincidan con "${search}".` : "Todavía no hay historias publicadas."}
            </p>
          )}

          <div className="landing-historia-grid">
            {resto.map((historia) => (
              <Link key={historia.id} href={`/historias/${historia.slug}`} className="landing-historia-card">
                <div className="landing-historia-card-image-wrap">
                  {historiaImageSrc(historia.bloques[0]?.imageUrl ?? null) && (
                    <img
                      className="landing-historia-card-image"
                      src={historiaImageSrc(historia.bloques[0]?.imageUrl ?? null)!}
                      alt={historia.titulo}
                    />
                  )}
                </div>
                <p className="landing-historia-card-meta">
                  {historia.categorias.map((c) => HISTORIA_CATEGORIA_LABELS[c.categoria]).join(" · ")}
                </p>
                <p className="landing-historia-card-title">{historia.bloques[0]?.texto1 || historia.titulo}</p>
                {historia.bloques[0]?.texto2 && <p className="landing-historia-card-related">{historia.bloques[0].texto2}</p>}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
