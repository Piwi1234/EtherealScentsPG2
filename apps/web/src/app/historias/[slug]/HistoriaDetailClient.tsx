"use client";

import { useState } from "react";
import Link from "next/link";
import { HISTORIA_CATEGORIA_LABELS, HistoriaBloqueImage, historiaImageSrc, historiaParagraphs, renderHistoriaInline } from "../../../lib/historia-display";
import type { HistoriaDetalle, HistoriaResumen } from "../../../lib/types";
import { LandingNavbar } from "../../../components/landing/LandingNavbar";
import { LandingFooter } from "../../../components/landing/LandingFooter";
import { HistoriaSugerenciaSection } from "./HistoriaSugerenciaSection";

function slugTitulo(historia: HistoriaResumen): string {
  return historia.bloques[0]?.texto1 || historia.titulo;
}

export function HistoriaDetailClient({
  historia,
  anterior,
  siguiente,
}: {
  historia: HistoriaDetalle;
  anterior: HistoriaResumen | null;
  siguiente: HistoriaResumen | null;
}) {
  const [copied, setCopied] = useState(false);

  const portada = historia.bloques.find((b) => b.orden === 0) ?? historia.bloques[0];
  const capitulos = historia.bloques.filter((b) => b.orden !== 0).sort((a, b) => a.orden - b.orden);
  const relacionadas = historia.relacionadas.map((r) => r.historiaB);

  const url = typeof window !== "undefined" ? window.location.href : `https://etherealscents-bo.com/historias/${historia.slug}`;
  const title = portada?.texto1 || historia.titulo;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard puede no estar disponible (http sin TLS, permisos) — sin feedback de error, no es crítico.
    }
  }

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <div className="landing-breadcrumb-bar">
        <div className="landing-container">
          <p className="landing-breadcrumb">
            <Link href="/home">Inicio</Link>
            <span>/</span>
            <Link href="/historias">Historias</Link>
            <span>/</span>
            <span className="landing-breadcrumb-current">{title}</span>
          </p>
        </div>
      </div>

      <section className="landing-section" style={{ paddingBottom: 0 }}>
        <div className="landing-container">
          <div className="landing-historia-split landing-historia-split--on-surface">
            <div className="landing-historia-split-text">
              <p className="landing-historia-eyebrow">
                <span className="landing-historia-eyebrow-label">PORTADA · EL ORIGEN</span>
                <span className="landing-historia-eyebrow-sep">——</span>
                <span className="landing-historia-eyebrow-meta">
                  {historia.categorias.map((c) => HISTORIA_CATEGORIA_LABELS[c.categoria]).join(" · ")}
                </span>
              </p>
              <h1 className="landing-historia-title" style={{ fontSize: 46 }}>
                {title}
              </h1>
              {portada?.texto2 && <p className="landing-historia-name" style={{ fontSize: 21 }}>{portada.texto2}</p>}
              {portada?.texto3 && <p className="landing-historia-tagline" style={{ fontSize: 19 }}>{portada.texto3}</p>}
              <div className="landing-historia-body" style={{ fontSize: 17 }}>
                {historiaParagraphs(portada?.texto4 ?? null).map((p, i) => (
                  <p key={i}>{renderHistoriaInline(p)}</p>
                ))}
              </div>
            </div>
            <div className="landing-historia-split-image-wrap">
              <HistoriaBloqueImage
                imageUrl={portada?.imageUrl ?? null}
                mobileImageUrl={portada?.mobileImageUrl ?? null}
                alt={title}
                className="landing-historia-split-image"
              />
              <div className="landing-historia-split-fade" />
            </div>
          </div>
        </div>
      </section>

      {capitulos.length > 0 && (
        <section className="landing-historia-toc">
          <div className="landing-container landing-historia-toc-inner">
            <span className="landing-historia-toc-label">EN ESTA HISTORIA</span>
            {capitulos.map((cap, i) => (
              <a key={cap.id} href={`#capitulo-${i + 1}`}>
                <span className="landing-historia-toc-number">{String(i + 1).padStart(2, "0")}</span>
                {cap.texto1 || `Capítulo ${i + 1}`}
              </a>
            ))}
          </div>
        </section>
      )}

      {capitulos.map((cap, i) => (
        <section
          id={`capitulo-${i + 1}`}
          key={cap.id}
          className="landing-historia-chapter"
          style={{ background: i % 2 === 0 ? "var(--es-surface)" : "var(--es-bg)" }}
        >
          <div className="landing-container">
            <div className={`landing-historia-split${i % 2 === 1 ? " landing-historia-split--reverse" : ""}${i % 2 === 0 ? " landing-historia-split--on-surface" : ""}`}>
              <div className="landing-historia-split-text">
                <p className="landing-historia-eyebrow">
                  <span className="landing-historia-eyebrow-label">{String(i + 1).padStart(2, "0")}</span>
                  <span className="landing-historia-eyebrow-sep">——</span>
                  <span className="landing-historia-eyebrow-meta">{(cap.texto1 || "").toUpperCase()}</span>
                </p>
                <h2 className="landing-historia-title" style={{ fontSize: 32 }}>
                  {cap.texto1}
                </h2>
                {cap.texto2 && <p className="landing-historia-name">{cap.texto2}</p>}
                {cap.texto3 && <p className="landing-historia-tagline">{cap.texto3}</p>}
                <div className="landing-historia-body">
                  {historiaParagraphs(cap.texto4).map((p, pi) => (
                    <p key={pi}>{renderHistoriaInline(p)}</p>
                  ))}
                </div>
              </div>
              <div className="landing-historia-split-image-wrap">
                <HistoriaBloqueImage
                  imageUrl={cap.imageUrl}
                  mobileImageUrl={cap.mobileImageUrl}
                  alt={cap.texto1 ?? ""}
                  className="landing-historia-split-image"
                />
                <div className="landing-historia-split-fade" />
              </div>
            </div>
          </div>
        </section>
      ))}

      <HistoriaSugerenciaSection historia={historia} />

      {relacionadas.length > 0 && (
        <section className="landing-historia-related" style={{ background: "var(--es-bg)" }}>
          <div className="landing-container">
            <p className="landing-eyebrow">Sigue explorando</p>
            <h2 className="landing-section-title">Historias relacionadas</h2>
            <div className="landing-historia-related-grid" style={{ marginTop: 32 }}>
              {relacionadas.map((rel) => (
                <Link key={rel.id} href={`/historias/${rel.slug}`} className="landing-historia-related-card">
                  <div className="landing-historia-card-image-wrap">
                    {historiaImageSrc(rel.bloques[0]?.imageUrl ?? null) && (
                      <img
                        className="landing-historia-card-image"
                        src={historiaImageSrc(rel.bloques[0]?.imageUrl ?? null)!}
                        alt={slugTitulo(rel)}
                      />
                    )}
                  </div>
                  <p className="landing-historia-related-category">
                    {rel.categorias.map((c) => HISTORIA_CATEGORIA_LABELS[c.categoria]).join(" · ")}
                  </p>
                  <p className="landing-historia-card-title">{slugTitulo(rel)}</p>
                </Link>
              ))}
            </div>
            <Link href="/historias" className="landing-historia-text-link">
              Ver todas las historias →
            </Link>
          </div>
        </section>
      )}

      <section className="landing-historia-nav">
        <div className="landing-container landing-historia-nav-inner">
          {anterior ? (
            <Link href={`/historias/${anterior.slug}`}>
              <p className="landing-historia-nav-label">← Historia anterior</p>
              <p className="landing-historia-nav-title">{slugTitulo(anterior)}</p>
            </Link>
          ) : (
            <div />
          )}

          <div className="landing-historia-nav-actions">
            <a
              className="landing-btn landing-btn-primary"
              href={`https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Compartir por WhatsApp
            </a>
            <button type="button" className="landing-btn landing-btn-outline-dark" onClick={handleCopyLink}>
              {copied ? "¡Copiado!" : "Copiar enlace"}
            </button>
          </div>

          {siguiente ? (
            <Link href={`/historias/${siguiente.slug}`} style={{ textAlign: "right" }}>
              <p className="landing-historia-nav-label">Siguiente historia →</p>
              <p className="landing-historia-nav-title">{slugTitulo(siguiente)}</p>
            </Link>
          ) : (
            <div style={{ textAlign: "right" }}>
              <p className="landing-historia-nav-label">SIGUIENTE HISTORIA →</p>
              <p className="landing-historia-nav-title landing-historia-nav-title--muted">Próximamente</p>
            </div>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
