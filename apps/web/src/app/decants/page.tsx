"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDecantFiltros, getPublicDecants } from "../../lib/api";
import type { DecantFiltros, DecantItem } from "../../lib/types";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { DecantCard } from "../../components/landing/DecantCard";
import { FilterOptionList } from "../../components/landing/FilterOptionList";

const PAGE_SIZE = 24;

const csv = (value: string | null) => (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);

/**
 * Perfumes que se venden por decants (2, 5, 10 ml...). Mismo esquema de filtros que /categoria y /buscar: barra lateral con casillas
 * (Tamaño, Ofertas, Marca), chips de lo aplicado y cajón de filtros en móvil. Los filtros viajan en la URL (ej. /decants?ml=5,10).
 */
export default function DecantsPage() {
  const [filtros, setFiltros] = useState<DecantFiltros | null>(null);
  const [tamanos, setTamanos] = useState<number[]>([]);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [orden, setOrden] = useState("recientes");
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<{ items: DecantItem[]; total: number } | null>(null);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  // Los filtros salen de la URL al entrar y se escriben de vuelta al cambiarlos.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setTamanos(csv(q.get("ml")).map(Number).filter((n) => Number.isInteger(n) && n > 0));
    setMarcas(csv(q.get("marca")));
    setSoloDisponibles(q.get("disponibles") === "true");
    setOrden(q.get("orden") ?? "recientes");
    setPagina(Number(q.get("pagina")) || 1);
    setListo(true);
    getDecantFiltros().then(setFiltros).catch(() => {});
  }, []);

  useEffect(() => {
    if (!listo) return;
    const q = new URLSearchParams();
    if (tamanos.length > 0) q.set("ml", tamanos.join(","));
    if (marcas.length > 0) q.set("marca", marcas.join(","));
    if (soloDisponibles) q.set("disponibles", "true");
    if (orden !== "recientes") q.set("orden", orden);
    if (pagina > 1) q.set("pagina", String(pagina));
    window.history.replaceState(null, "", q.toString() ? `/decants?${q.toString()}` : "/decants");

    let vigente = true;
    setError("");
    getPublicDecants({
      ml: tamanos.join(",") || undefined,
      brandId: marcas.join(",") || undefined,
      onlyInStock: soloDisponibles,
      sortBy: orden === "recientes" ? undefined : orden,
      page: pagina,
      pageSize: PAGE_SIZE,
    })
      .then((r) => vigente && setLista({ items: r.items, total: r.total }))
      .catch((e) => vigente && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      vigente = false;
    };
  }, [listo, tamanos, marcas, soloDisponibles, orden, pagina]);

  function alternarTamano(ml: number) {
    setTamanos((prev) => (prev.includes(ml) ? prev.filter((t) => t !== ml) : [...prev, ml].sort((a, b) => a - b)));
    setPagina(1);
  }
  function alternarMarca(id: string) {
    setMarcas((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
    setPagina(1);
  }
  function limpiar() {
    setTamanos([]);
    setMarcas([]);
    setSoloDisponibles(false);
    setPagina(1);
  }

  const filtrosActivos = tamanos.length + marcas.length + (soloDisponibles ? 1 : 0);
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  for (const ml of tamanos) chips.push({ key: `ml-${ml}`, label: `${ml} ml`, onRemove: () => alternarTamano(ml) });
  for (const id of marcas) {
    const marca = filtros?.marcas.find((m) => m.id === id);
    if (marca) chips.push({ key: `marca-${id}`, label: marca.name, onRemove: () => alternarMarca(id) });
  }
  if (soloDisponibles) chips.push({ key: "disp", label: "En Stock", onRemove: () => { setSoloDisponibles(false); setPagina(1); } });

  const hayBarra = (filtros?.tamanos.length ?? 0) > 0 || (filtros?.marcas.length ?? 0) > 0;
  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / PAGE_SIZE)) : 1;

  const grupos = (
    <div className="landing-filter-groups-box">
      {(filtros?.tamanos.length ?? 0) > 0 && (
        <div className="landing-filter-group">
          <p className="landing-filter-group-title">Tamaño</p>
          {filtros!.tamanos.map((t) => (
            <label className="landing-filter-checkbox" key={t.ml}>
              <input type="checkbox" checked={tamanos.includes(t.ml)} onChange={() => alternarTamano(t.ml)} />
              <span className="landing-filter-checkbox-label">{t.ml} ml</span>
              <span className="landing-filter-count">{t.count}</span>
            </label>
          ))}
        </div>
      )}

      <div className="landing-filter-group">
        <p className="landing-filter-group-title">Ofertas</p>
        <label className="landing-filter-checkbox">
          <input type="checkbox" checked={soloDisponibles} onChange={() => { setSoloDisponibles((v) => !v); setPagina(1); }} />
          <span className="landing-filter-checkbox-label landing-filter-checkbox-label--stock">En Stock</span>
        </label>
      </div>

      {(filtros?.marcas.length ?? 0) > 0 && (
        <FilterOptionList
          title="Marca"
          options={filtros!.marcas.map((m) => ({ value: m.id, label: m.name, count: m.count }))}
          selected={marcas}
          onToggle={alternarMarca}
          variant="scroll"
        />
      )}
    </div>
  );

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <div className="landing-breadcrumb-bar">
        <div className="landing-container">
          <p className="landing-breadcrumb">
            <Link href="/home">Inicio</Link>
            <span>/</span>
            <span className="landing-breadcrumb-current">Decants</span>
          </p>
        </div>
      </div>

      <section className="landing-category-header">
        <div className="landing-container">
          <h1>Decants</h1>
          <p className="landing-category-lead">Prueba tus perfumes favoritos en el tamaño que prefieras, sin comprar el frasco completo.</p>
        </div>
      </section>

      <section className="landing-section landing-section--category">
        <div className="landing-container landing-category-layout" id="decants-filters-top">
          {hayBarra && (
            <aside className="landing-filters-sidebar">
              <div className="landing-filters-sidebar-header">
                <p className="landing-toolbar-filter-label">Filtros</p>
                {filtrosActivos > 0 && (
                  <button type="button" className="landing-filter-clear" onClick={limpiar}>
                    Limpiar
                  </button>
                )}
              </div>
              {grupos}
            </aside>
          )}

          {chips.length > 0 && (
            <div className="landing-active-filters">
              {chips.map((chip) => (
                <span className="landing-active-filter-chip" key={chip.key}>
                  {chip.label}
                  <button type="button" className="landing-active-filter-chip-remove" aria-label={`Quitar filtro ${chip.label}`} onClick={chip.onRemove}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="landing-category-main">
            <div className="landing-toolbar">
              {hayBarra && (
                <button type="button" className="landing-filters-mobile-btn" onClick={() => setDrawerAbierto(true)}>
                  Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ""}
                </button>
              )}
              <p className="landing-toolbar-count">{lista ? `${lista.total} perfume${lista.total === 1 ? "" : "s"}` : ""}</p>
              <label className="landing-sort-control">
                <span className="landing-sort-label">Ordenar por:</span>
                <select className="landing-select" value={orden} onChange={(e) => { setOrden(e.target.value); setPagina(1); }}>
                  <option value="recientes">Más recientes</option>
                  <option value="precio-asc">Precio: menor a mayor</option>
                  <option value="precio-desc">Precio: mayor a menor</option>
                  <option value="nombre-asc">Nombre: A-Z</option>
                </select>
              </label>
            </div>

            {error && <p className="error-text">{error}</p>}
            {!error && !lista && <p className="landing-empty-note">Cargando...</p>}
            {lista && lista.items.length === 0 && (
              <p className="landing-empty-note">{filtrosActivos > 0 ? "No hay decants para mostrar con estos filtros." : "Por ahora no hay decants disponibles."}</p>
            )}

            {lista && lista.items.length > 0 && (
              <>
                <div className="landing-product-grid">
                  {lista.items.map((item) => (
                    <DecantCard key={`${item.id}:${tamanos.join(",")}`} item={item} />
                  ))}
                </div>
                {totalPaginas > 1 && (
                  <div className="landing-pagination">
                    <button
                      type="button"
                      className="landing-btn landing-btn-outline-dark"
                      disabled={pagina <= 1}
                      onClick={() => {
                        setPagina(pagina - 1);
                        document.getElementById("decants-filters-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      ← Anterior
                    </button>
                    <span className="landing-pagination-info">
                      Página {pagina} de {totalPaginas}
                    </span>
                    <button
                      type="button"
                      className="landing-btn landing-btn-outline-dark"
                      disabled={pagina >= totalPaginas}
                      onClick={() => {
                        setPagina(pagina + 1);
                        document.getElementById("decants-filters-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {drawerAbierto && (
        <div className="landing-filters-drawer-overlay" onClick={() => setDrawerAbierto(false)}>
          <div className="landing-filters-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="landing-filters-drawer-header">
              <p className="landing-toolbar-filter-label">Filtros</p>
              <button type="button" className="landing-filters-drawer-close" aria-label="Cerrar filtros" onClick={() => setDrawerAbierto(false)}>
                ×
              </button>
            </div>
            <div className="landing-filters-drawer-body">{grupos}</div>
            <div className="landing-filters-drawer-footer">
              {filtrosActivos > 0 && (
                <button type="button" className="landing-btn landing-btn-outline-dark" onClick={limpiar}>
                  Limpiar
                </button>
              )}
              <button type="button" className="landing-btn landing-btn-primary" onClick={() => setDrawerAbierto(false)}>
                Ver {lista?.total ?? 0} perfume{lista?.total === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}

      <LandingFooter />
    </div>
  );
}
