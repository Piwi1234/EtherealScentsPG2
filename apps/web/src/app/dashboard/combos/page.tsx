"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, deleteCombo, getCategories, getCombos, updateCombo } from "../../../lib/api";
import { productImageSrc } from "../../../lib/catalog-display";
import type { Category, Combo } from "../../../lib/types";

function bs(n: number): string {
  return `Bs ${n.toFixed(2)}`;
}

function resumenComponentes(combo: Combo): string {
  return combo.items.map((i) => `${i.cantidad > 1 ? `${i.cantidad}× ` : ""}${i.producto.name}${i.variante.etiqueta ? ` (${i.variante.etiqueta})` : ""}`).join(" + ");
}

/**
 * Combos: 2 a 4 productos de una misma categoría que se venden juntos con un descuento fijo en Bs. Se arman acá y los
 * publicados se muestran en la web pública. El precio se calcula en vivo con el precio actual de cada producto.
 */
export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[] | null>(null);
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [buscar, setBuscar] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getCategories()
      .then(setCategorias)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setBuscar(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const cargar = useCallback(() => {
    getCombos({ categoryId: categoryId || undefined, search: buscar || undefined })
      .then(setCombos)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)));
  }, [categoryId, buscar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const raices = useMemo(() => categorias.filter((c) => c.parentId === null), [categorias]);

  // Agrupados por categoría (el nombre de la categoría del combo).
  const grupos = useMemo(() => {
    const map = new Map<string, Combo[]>();
    for (const c of combos ?? []) map.set(c.category.name, [...(map.get(c.category.name) ?? []), c]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [combos]);

  async function alternarPublicado(combo: Combo) {
    try {
      await updateCombo(combo.id, { publicado: !combo.publicado });
      cargar();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function eliminar(combo: Combo) {
    if (!confirm(`¿Eliminar el combo "${combo.nombre}"? Los productos que lo componen no se tocan.`)) return;
    try {
      await deleteCombo(combo.id);
      cargar();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Combos</h1>
        <Link href="/dashboard/combos/new" className="btn-cta">
          <span className="btn-cta-icon">+</span> Nuevo combo
        </Link>
      </div>
      <p className="cell-muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
        De 2 a 4 productos de una misma categoría que se venden juntos con un descuento fijo en Bs sobre la suma de sus precios. Los combos
        publicados aparecen en la web. El precio se actualiza solo si cambia el de algún producto.
      </p>

      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <div className="filter-field">
          <label className="filter-label">Categoría</label>
          <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todas</option>
            {raices.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field" style={{ minWidth: 240, flex: 1 }}>
          <label className="filter-label">Nombre o código</label>
          <input className="field" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." />
        </div>
      </div>

      {!combos && <p className="cell-muted">Cargando...</p>}
      {combos && combos.length === 0 && <p className="cell-muted">Todavía no hay combos. Crea el primero con “Nuevo combo”.</p>}

      {grupos.map(([categoria, lista]) => (
        <section key={categoria} style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>
            {categoria} <span className="cell-muted" style={{ fontWeight: 400 }}>· {lista.length}</span>
          </h2>
          <div className="table-scroll">
            <table className="table table-minimal table-compact">
              <thead>
                <tr>
                  <th>Imagen</th>
                  <th style={{ minWidth: 240 }}>Combo</th>
                  <th className="num">Suma</th>
                  <th className="num">Descuento</th>
                  <th className="num">Precio combo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((combo) => {
                  const img = productImageSrc(combo.imageUrl);
                  return (
                    <tr key={combo.id}>
                      <td>
                        {img ? (
                          <img src={img} alt={combo.nombre} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }} />
                        ) : (
                          <span className="cell-muted">Sin imagen</span>
                        )}
                      </td>
                      <td className="cell-primary">
                        <Link href={`/dashboard/combos/${combo.id}`} className="link-button">
                          {combo.nombre}
                        </Link>
                        <span className="cell-muted" style={{ marginLeft: 8, fontSize: 12, fontWeight: 400 }}>
                          {combo.comboCode}
                        </span>
                        <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>
                          {resumenComponentes(combo)}
                        </div>
                      </td>
                      <td className="num cell-muted">{bs(combo.sumaBs)}</td>
                      <td className="num cell-muted">− {bs(combo.descuentoBs)}</td>
                      <td className="num cell-primary">{bs(combo.totalBs)}</td>
                      <td>
                        <span className={`badge ${combo.publicado ? "badge-success" : "badge-muted"}`}>{combo.publicado ? "Publicado" : "Borrador"}</span>
                        {combo.agotado && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Sin stock</span>}
                        {combo.preventa && <span className="badge badge-warn" style={{ marginLeft: 6 }}>Preventa</span>}
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link href={`/dashboard/combos/${combo.id}`} className="action-btn">
                            Editar
                          </Link>
                          <button type="button" className="action-btn" onClick={() => alternarPublicado(combo)}>
                            {combo.publicado ? "Ocultar" : "Publicar"}
                          </button>
                          <button type="button" className="action-btn danger" onClick={() => eliminar(combo)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
