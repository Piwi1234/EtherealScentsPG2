"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  API_ORIGIN,
  ApiError,
  clearHistoriaDestacada,
  deleteHistoria,
  getHistoriaDestacada,
  getHistoriasAdmin,
  moveHistoria,
  setHistoriaDestacada,
} from "../../../lib/api";
import type { HistoriaResumen } from "../../../lib/types";

const CATEGORIA_LABELS: Record<string, string> = {
  CASAS: "Casas",
  PERFUMISTAS: "Perfumistas",
  INGREDIENTES: "Ingredientes",
  FRAGANCIAS: "Fragancias",
  APRENDE: "Aprende",
};

function imgSrc(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

export default function HistoriasPage() {
  const [historias, setHistorias] = useState<HistoriaResumen[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  // Null = ninguna marcada a mano (ambas pantallas públicas caen a la más reciente publicada) — no
  // hay forma de leerlo desde /historias/admin, así que se pide aparte a /historias/destacada.
  const [destacadaId, setDestacadaId] = useState<string | null | undefined>(undefined);

  function load() {
    setError("");
    Promise.all([getHistoriasAdmin(), getHistoriaDestacada()])
      .then(([list, destacada]) => {
        setHistorias(list);
        setDestacadaId(destacada?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(load, []);

  async function handleDelete(historia: HistoriaResumen) {
    if (!confirm(`¿Eliminar la historia "${historia.titulo}"? Se borran también sus bloques e imágenes.`)) return;
    setBusyId(historia.id);
    try {
      await deleteHistoria(historia.id);
      load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(historia: HistoriaResumen, direction: "up" | "down") {
    setBusyId(historia.id);
    try {
      await moveHistoria(historia.id, direction);
      load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleDestacada(historia: HistoriaResumen) {
    setBusyId(historia.id);
    try {
      if (destacadaId === historia.id) {
        await clearHistoriaDestacada();
      } else {
        await setHistoriaDestacada(historia.id);
      }
      load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>Historias</h1>
          <p className="cell-muted" style={{ fontSize: 12.5, margin: "4px 0 0" }}>
            Alimenta /historias y el bloque &quot;Última historia&quot; del home. La destacada (★) se
            marca a mano; sin ninguna marcada, se usa la publicada más reciente.
          </p>
        </div>
        <Link href="/dashboard/historias/new" className="btn-cta">
          <span className="btn-cta-icon">+</span> Nueva historia
        </Link>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!historias && !error && <p>Cargando...</p>}
      {historias && historias.length === 0 && <p>No hay historias todavía.</p>}

      {historias && historias.length > 0 && (
        <table className="table table-minimal table-compact">
          <thead>
            <tr>
              <th></th>
              <th>Título</th>
              <th>Categorías</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {historias.map((historia, index) => {
              const portada = historia.bloques[0];
              const src = imgSrc(portada?.imageUrl ?? null);
              const busy = busyId === historia.id;
              return (
                <tr key={historia.id}>
                  <td style={{ width: 56 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "var(--es-navy-100, #e8ecf4)",
                      }}
                    >
                      {src && <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                  </td>
                  <td className="cell-primary">
                    {historia.titulo}
                    {destacadaId === historia.id && (
                      <span className="cell-muted" style={{ marginLeft: 8, fontSize: 11 }}>★ Destacada</span>
                    )}
                  </td>
                  <td className="cell-muted">
                    {historia.categorias.map((c) => CATEGORIA_LABELS[c.categoria]).join(" · ") || "—"}
                  </td>
                  <td>
                    <span className={`badge${historia.publicada ? "" : " badge-muted"}`}>
                      {historia.publicada ? "Publicada" : "Borrador"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="action-btn"
                        disabled={busy || index === 0}
                        onClick={() => handleMove(historia, "up")}
                        aria-label="Mover antes"
                        title="Mover antes"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        disabled={busy || index === historias.length - 1}
                        onClick={() => handleMove(historia, "down")}
                        aria-label="Mover después"
                        title="Mover después"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        disabled={busy}
                        onClick={() => handleToggleDestacada(historia)}
                        title={destacadaId === historia.id ? "Quitar como destacada" : "Marcar como destacada"}
                      >
                        {destacadaId === historia.id ? "★" : "☆"}
                      </button>
                      <Link href={`/dashboard/historias/${historia.id}/edit`} className="action-btn">
                        Editar
                      </Link>
                      <button type="button" className="action-btn danger" disabled={busy} onClick={() => handleDelete(historia)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
