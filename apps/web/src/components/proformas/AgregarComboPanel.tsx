"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, addComboToProforma } from "../../lib/api";
import { productImageSrc } from "../../lib/catalog-display";
import { contieneBusqueda } from "../../lib/busqueda";
import type { Combo } from "../../lib/types";
import { Selector } from "../stock/ExistenciasLista";

function bs(n: number): string {
  return `Bs ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type FiltroEstado = "" | "CON_STOCK" | "PREVENTA";

/**
 * Vender combos en una nota de venta en borrador (pestaña «Combos» de Agregar producto): tarjetas con el contenido, el precio y el ahorro; se
 * elige cuántos y se agregan sus productos como líneas normales con el descuento del combo repartido. Se puede buscar y filtrar por categoría
 * y por estado (con stock o en preventa).
 */
export function AgregarComboPanel({ proformaId, combos, onAgregado }: { proformaId: string; combos: Combo[]; onAgregado?: () => void }) {
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>("");

  const categorias = useMemo(() => Array.from(new Map(combos.map((c) => [c.category.id, c.category.name])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [combos]);
  const visibles = combos.filter(
    (c) =>
      (!searchInput.trim() || contieneBusqueda(c.nombre, searchInput.trim()) || c.items.some((i) => contieneBusqueda(i.producto.name, searchInput.trim()))) &&
      (!categoriaId || c.category.id === categoriaId) &&
      (estado === "" || (estado === "CON_STOCK" ? !c.agotado : c.preventa)),
  );

  async function agregar(combo: Combo) {
    const cantidad = cantidades[combo.id] ?? 1;
    setBusyId(combo.id);
    setError("");
    setAviso("");
    try {
      await addComboToProforma(proformaId, combo.id, cantidad);
      setAviso(`Agregado: ${cantidad} × ${combo.nombre}.`);
      onAgregado?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (combos.length === 0) {
    return <p className="cell-muted">Todavía no hay combos creados. Se crean en Gestión → Combos.</p>;
  }

  return (
    <div>
      <div className="ex-toolbar">
        <label className="ex-search">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input type="search" placeholder="Buscar combo o producto del combo…" aria-label="Buscar combos" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </label>
        {categorias.length > 1 && (
          <Selector etiqueta="Categoría" texto={categorias.find(([id]) => id === categoriaId)?.[1] ?? "Todas"} activo={Boolean(categoriaId)} valor={categoriaId} onChange={setCategoriaId}>
            <option value="">Todas</option>
            {categorias.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </Selector>
        )}
        <div className="seg" role="group" aria-label="Estado del combo">
          {(
            [
              ["", "Todos"],
              ["CON_STOCK", "Con stock"],
              ["PREVENTA", "Preventa"],
            ] as const
          ).map(([valor, texto]) => (
            <button key={valor} type="button" className={estado === valor ? "on" : undefined} onClick={() => setEstado(valor)}>
              {texto}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error-text" style={{ margin: "12px 0 0" }}>{error}</p>}
      {aviso && (
        <p style={{ margin: "12px 0 0", fontSize: 13 }}>
          {aviso}{" "}
          <Link href={`/dashboard/proformas/${proformaId}`} className="link-button">
            Ver la nota
          </Link>
        </p>
      )}

      {visibles.length === 0 ? (
        <p className="cell-muted" style={{ marginTop: 14 }}>Ningún combo coincide con esos filtros.</p>
      ) : (
        <div className="ac-grid">
          {visibles.map((combo) => {
            const img = productImageSrc(combo.imageUrl);
            const cantidad = cantidades[combo.id] ?? 1;
            return (
              <article key={combo.id} className={`ac-card${combo.agotado ? " ac-card--agotado" : ""}`}>
                <div className="ac-card-head">
                  {img ? <img src={img} alt={combo.nombre} /> : <span className="ac-sin-img" aria-hidden="true" />}
                  <div>
                    <strong>{combo.nombre}</strong>
                    <div className="cell-muted" style={{ fontSize: 12 }}>
                      {combo.category.name}
                      {combo.agotado && <span className="badge badge-danger" style={{ marginLeft: 8 }}>Sin stock</span>}
                      {combo.preventa && <span className="badge badge-warn" style={{ marginLeft: 8 }}>Preventa</span>}
                    </div>
                  </div>
                </div>
                <p className="ac-items">
                  {combo.items.map((i) => `${i.cantidad > 1 ? `${i.cantidad}× ` : ""}${i.producto.name}${i.variante.etiqueta ? ` (${i.variante.etiqueta})` : ""}`).join(" + ")}
                </p>
                <div className="ac-precio">
                  <div>
                    <strong>{bs(combo.totalBs)}</strong>
                    <div className="cell-muted" style={{ fontSize: 12 }}>
                      <s>{bs(combo.sumaBs)}</s>
                    </div>
                  </div>
                  <span className="ac-ahorro">Ahorras {bs(combo.ahorroBs)}</span>
                </div>
                <div className="ac-acciones">
                  <span className="qty-stepper">
                    <button type="button" aria-label="Menos" disabled={cantidad <= 1} onClick={() => setCantidades((p) => ({ ...p, [combo.id]: cantidad - 1 }))}>
                      −
                    </button>
                    <input type="number" readOnly value={cantidad} aria-label={`Cantidad de ${combo.nombre}`} />
                    <button type="button" aria-label="Más" disabled={cantidad >= 99} onClick={() => setCantidades((p) => ({ ...p, [combo.id]: cantidad + 1 }))}>
                      +
                    </button>
                  </span>
                  <button type="button" className={combo.agotado ? "action-btn" : "button"} disabled={busyId !== null} onClick={() => agregar(combo)}>
                    {busyId === combo.id ? "Agregando..." : combo.agotado ? "Agregar de todos modos" : "Agregar combo"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="cell-muted" style={{ fontSize: 12.5, margin: "14px 0 0" }}>
        Al agregar un combo se cargan sus productos como líneas con el descuento ya repartido. Después puedes cambiar cuántos combos lleva la nota o
        quitarlo desde su encabezado.
      </p>
    </div>
  );
}
