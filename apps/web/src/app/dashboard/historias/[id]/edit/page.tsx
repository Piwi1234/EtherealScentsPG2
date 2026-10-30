"use client";
import { contieneBusqueda } from "../../../../../lib/busqueda";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addHistoriaBloque,
  addHistoriaRelacionada,
  ApiError,
  getHistoria,
  getHistoriasAdmin,
  moveHistoriaBloque,
  removeHistoriaBloque,
  removeHistoriaRelacionada,
  updateHistoria,
} from "../../../../../lib/api";
import type { HistoriaCategoria, HistoriaDetalle, HistoriaResumen } from "../../../../../lib/types";
import { HistoriaBloqueEditor } from "../../HistoriaBloqueEditor";
import { HistoriaHomeImageEditor } from "../../HistoriaHomeImageEditor";
import { HistoriaSugerenciaEditor } from "../../HistoriaSugerenciaEditor";

const CATEGORIAS: { value: HistoriaCategoria; label: string }[] = [
  { value: "CASAS", label: "Casas" },
  { value: "PERFUMISTAS", label: "Perfumistas" },
  { value: "INGREDIENTES", label: "Ingredientes" },
  { value: "FRAGANCIAS", label: "Fragancias" },
  { value: "APRENDE", label: "Aprende" },
];

function reportError(e: unknown) {
  alert(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
}

export default function EditHistoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [historia, setHistoria] = useState<HistoriaDetalle | null>(null);
  const [loadError, setLoadError] = useState("");

  function load() {
    getHistoria(id)
      .then(setHistoria)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)));
  }

  useEffect(load, [id]);

  if (loadError) {
    return (
      <div className="card">
        <p className="error-text">{loadError}</p>
        <button type="button" className="link-button" onClick={() => router.push("/dashboard/historias")}>
          Volver
        </button>
      </div>
    );
  }

  if (!historia) {
    return (
      <div className="card">
        <p>Cargando...</p>
      </div>
    );
  }

  return <HistoriaEditor historia={historia} onChanged={load} />;
}

function HistoriaEditor({ historia, onChanged }: { historia: HistoriaDetalle; onChanged: () => void }) {
  const router = useRouter();

  const [titulo, setTitulo] = useState(historia.titulo);
  const [slug, setSlug] = useState(historia.slug);
  const [categorias, setCategorias] = useState<HistoriaCategoria[]>(historia.categorias.map((c) => c.categoria));
  const [publicada, setPublicada] = useState(historia.publicada);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState("");

  const [addingBloque, setAddingBloque] = useState(false);

  const [relacionadaSearch, setRelacionadaSearch] = useState("");
  const [todasHistorias, setTodasHistorias] = useState<HistoriaResumen[] | null>(null);
  const [addingRelacionadaId, setAddingRelacionadaId] = useState<string | null>(null);

  useEffect(() => {
    getHistoriasAdmin().then(setTodasHistorias).catch(() => setTodasHistorias([]));
  }, []);

  function toggleCategoria(value: HistoriaCategoria) {
    setCategorias((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]));
  }

  async function handleSaveMeta(e: React.FormEvent) {
    e.preventDefault();
    setMetaError("");
    if (categorias.length === 0) {
      setMetaError("Elegí al menos una categoría.");
      return;
    }
    setSavingMeta(true);
    try {
      await updateHistoria(historia.id, { titulo, slug, categorias, publicada });
      onChanged();
    } catch (e) {
      setMetaError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleAddBloque() {
    setAddingBloque(true);
    try {
      await addHistoriaBloque(historia.id);
      onChanged();
    } catch (e) {
      reportError(e);
    } finally {
      setAddingBloque(false);
    }
  }

  async function handleRemoveBloque(bloqueId: string) {
    if (!confirm("¿Eliminar este bloque?")) return;
    try {
      await removeHistoriaBloque(historia.id, bloqueId);
      onChanged();
    } catch (e) {
      reportError(e);
    }
  }

  async function handleMoveBloque(bloqueId: string, direction: "up" | "down") {
    try {
      await moveHistoriaBloque(historia.id, bloqueId, direction);
      onChanged();
    } catch (e) {
      reportError(e);
    }
  }

  async function handleAddRelacionada(relacionadaId: string) {
    setAddingRelacionadaId(relacionadaId);
    try {
      await addHistoriaRelacionada(historia.id, relacionadaId);
      setRelacionadaSearch("");
      onChanged();
    } catch (e) {
      reportError(e);
    } finally {
      setAddingRelacionadaId(null);
    }
  }

  async function handleRemoveRelacionada(relacionadaId: string) {
    try {
      await removeHistoriaRelacionada(historia.id, relacionadaId);
      onChanged();
    } catch (e) {
      reportError(e);
    }
  }

  const portada = historia.bloques.find((b) => b.orden === 0) ?? historia.bloques[0];
  const extraBloques = historia.bloques.filter((b) => b.orden !== 0).sort((a, b) => a.orden - b.orden);

  const relacionadaIds = useMemo(() => new Set(historia.relacionadas.map((r) => r.historiaB.id)), [historia]);
  const searchResults = useMemo(() => {
    if (!todasHistorias || relacionadaSearch.trim().length < 2) return [];
    const q = relacionadaSearch.trim().toLowerCase();
    return todasHistorias
      .filter((h) => h.id !== historia.id && !relacionadaIds.has(h.id))
      .filter((h) => contieneBusqueda(h.titulo, q))
      .slice(0, 8);
  }, [todasHistorias, relacionadaSearch, relacionadaIds, historia.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Editar historia</h1>
          <button type="button" className="link-button" onClick={() => router.push("/dashboard/historias")}>
            ← Volver al listado
          </button>
        </div>

        <form className="form-grid" onSubmit={handleSaveMeta}>
          <div>
            <label>Título</label>
            <input className="field" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          </div>
          <div>
            <label>Slug</label>
            <input className="field" value={slug} onChange={(e) => setSlug(e.target.value)} required />
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
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={publicada} onChange={(e) => setPublicada(e.target.checked)} />
              Publicada (visible en /historias)
            </label>
          </div>
          {metaError && <p className="error-text">{metaError}</p>}
          <div className="form-actions">
            <button type="submit" className="button" disabled={savingMeta}>
              {savingMeta ? "Guardando..." : "Guardar datos"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Página principal</h2>
        <p className="cell-muted" style={{ fontSize: 12, margin: "0 0 16px" }}>
          Es obligatoria y no se puede eliminar — es la portada de la historia.
        </p>
        {portada && (
          <HistoriaBloqueEditor
            historiaId={historia.id}
            bloque={portada}
            titulo="Página principal (portada)"
            esPortada
            canMoveUp={false}
            canMoveDown={false}
            onChanged={onChanged}
            onRemove={() => {}}
            onMove={() => {}}
          />
        )}
      </div>

      <HistoriaHomeImageEditor historia={historia} onChanged={onChanged} />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Bloques adicionales</h2>
          <button type="button" className="btn-cta" disabled={addingBloque} onClick={handleAddBloque}>
            <span className="btn-cta-icon">+</span> {addingBloque ? "Agregando..." : "Agregar bloque"}
          </button>
        </div>
        <p className="cell-muted" style={{ fontSize: 12, margin: "0 0 16px" }}>
          Mismos campos que la página principal — se muestran en este orden dentro de la historia.
        </p>

        {extraBloques.length === 0 && <p className="cell-muted" style={{ fontSize: 13 }}>Sin bloques adicionales todavía.</p>}

        {extraBloques.map((bloque, index) => (
          <HistoriaBloqueEditor
            key={bloque.id}
            historiaId={historia.id}
            bloque={bloque}
            titulo={`Bloque ${index + 1}`}
            esPortada={false}
            canMoveUp={index > 0}
            canMoveDown={index < extraBloques.length - 1}
            onChanged={onChanged}
            onRemove={() => handleRemoveBloque(bloque.id)}
            onMove={(direction) => handleMoveBloque(bloque.id, direction)}
          />
        ))}
      </div>

      <HistoriaSugerenciaEditor historia={historia} onChanged={onChanged} />

      <div className="card">
        <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Historias relacionadas</h2>
        <p className="cell-muted" style={{ fontSize: 12, margin: "0 0 16px" }}>
          Manual y recíproco: si agregás una acá, esta historia también aparece como relacionada en
          esa otra. Sin ninguna, ese bloque no se muestra en la página pública.
        </p>

        {historia.relacionadas.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {historia.relacionadas.map((r) => (
              <span
                key={r.historiaB.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--line)",
                  fontSize: 12.5,
                }}
              >
                {r.historiaB.titulo}
                <button
                  type="button"
                  className="action-btn danger"
                  onClick={() => handleRemoveRelacionada(r.historiaB.id)}
                  title="Quitar relación"
                  style={{ width: 18, height: 18, padding: 0, fontSize: 11, lineHeight: 1, borderRadius: "50%" }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div style={{ position: "relative", maxWidth: 360 }}>
          <input
            className="field"
            value={relacionadaSearch}
            onChange={(e) => setRelacionadaSearch(e.target.value)}
            placeholder="Buscar historia por título..."
          />
          {searchResults.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 10,
                background: "var(--surface, #fff)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                marginTop: 4,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {searchResults.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  disabled={addingRelacionadaId === h.id}
                  onClick={() => handleAddRelacionada(h.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    fontSize: 13,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {h.titulo}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
