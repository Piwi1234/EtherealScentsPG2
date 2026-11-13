"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { productImageSrc } from "../../lib/catalog-display";
import type { Almacen, Brand, Category, StockOrden, StockResumen, StockResumenRow } from "../../lib/types";
import { formatAtributosVisibles } from "../proformas/AtributosVisibles";

export type OrdenExistencias = { key: StockOrden; dir: "asc" | "desc" };

const ORDENES: { label: string; valor: OrdenExistencias }[] = [
  { label: "Producto A–Z", valor: { key: "producto", dir: "asc" } },
  { label: "Menos disponible", valor: { key: "disponible", dir: "asc" } },
  { label: "Más disponible", valor: { key: "disponible", dir: "desc" } },
  { label: "Mayor valor", valor: { key: "valor", dir: "desc" } },
  { label: "Más unidades", valor: { key: "fisica", dir: "desc" } },
];

// Columnas que se pueden mostrar u ocultar (las demás —producto, categoría, estado, disponible, física, en tránsito y valor— siempre están).
const COLUMNAS_OPCIONALES = [
  { id: "reservada", label: "Reservada" },
  { id: "transitoDisp", label: "Disponible en tránsito" },
  { id: "transitoRes", label: "Reservado de tránsito" },
  { id: "almacenes", label: "Almacenes" },
] as const;
type ColumnaOpcional = (typeof COLUMNAS_OPCIONALES)[number]["id"];
const STORAGE_COLUMNAS = "existencias-columnas";

function bs(value: number): string {
  return value > 0 ? value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}

/** Atributos que distinguen esta variante (ej. "Tamaño: 90 ML") + los heredados marcados mostrarEnProforma. */
function atributosLabel(row: StockResumenRow): string | null {
  const opciones = row.variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(row.variante.product.attributeValues, row.variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function estadoDe(row: StockResumenRow): { texto: string; tono: "ok" | "warn" | "info" | "bad" } {
  if (row.cantidadFisica <= 0) return row.cantidadEnTransito > 0 ? { texto: "Solo en camino", tono: "info" } : { texto: "Sin stock", tono: "bad" };
  if (row.disponible <= 0) return { texto: "Todo reservado", tono: "warn" };
  if (row.cantidadEnTransito > 0) return { texto: "Con reposición en camino", tono: "info" };
  return { texto: "Con stock", tono: "ok" };
}

const ICONO_BUSCAR = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

function FlechaOrden({ dir }: { dir: "asc" | "desc" | null }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === "asc" ? <path d="M12 19V5M6 11l6-6 6 6" /> : dir === "desc" ? <path d="M12 5v14M6 13l6 6 6-6" /> : <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />}
    </svg>
  );
}

/**
 * Filtro desplegable en forma de píldora: etiqueta, valor actual y flecha. El <select> nativo queda encima, invisible, para
 * conservar el desplegable y el teclado del navegador sin su caja. Se resalta cuando el filtro está aplicado.
 */
export function Selector({
  etiqueta,
  texto,
  activo,
  valor,
  onChange,
  disabled,
  children,
}: {
  etiqueta: string;
  texto: string;
  activo?: boolean;
  valor: string | number;
  onChange: (value: string) => void;
  /** Filtro que depende de otro (ej. Subcategoría sin Categoría): se ve atenuado y no se abre. */
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`ex-select${activo ? " ex-select--on" : ""}${disabled ? " ex-select--off" : ""}`}>
      <span className="ex-select-etiqueta">{etiqueta}</span>
      <strong>{texto}</strong>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select aria-label={etiqueta} value={valor} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

/** Encabezado de columna ordenable: un clic ordena por ella y otro invierte el sentido. */
function Th({
  k,
  orden,
  onSort,
  children,
  num,
  primera,
}: {
  k: StockOrden;
  orden: OrdenExistencias;
  onSort: (key: StockOrden, primera?: "asc" | "desc") => void;
  children: React.ReactNode;
  num?: boolean;
  primera?: "asc" | "desc";
}) {
  const activo = orden.key === k;
  return (
    <th className={num ? "num" : undefined} aria-sort={activo ? (orden.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={`ex-th${activo ? " ex-th--on" : ""}`} onClick={() => onSort(k, primera)}>
        {children}
        <FlechaOrden dir={activo ? orden.dir : null} />
      </button>
    </th>
  );
}

/**
 * Lista de Existencias: barra de búsqueda y filtros, chips de categoría con su conteo y la tabla con columnas ordenables. Los
 * datos y los filtros viven en la página; acá solo se pintan y se avisa de cada cambio.
 */
export function ExistenciasLista({
  page,
  loading,
  almacenes,
  categories,
  brands,
  searchInput,
  onSearchInput,
  estado,
  onEstado,
  almacenId,
  onAlmacen,
  categoryId,
  onCategory,
  marcaId,
  onMarca,
  orden,
  onOrden,
  abiertoId,
  onOpen,
}: {
  page: StockResumen | null;
  loading: boolean;
  almacenes: Almacen[];
  categories: Category[];
  brands: Brand[];
  searchInput: string;
  onSearchInput: (value: string) => void;
  estado: "" | "SIN_DISPONIBLE" | "CON_DISPONIBLE";
  onEstado: (value: "" | "SIN_DISPONIBLE" | "CON_DISPONIBLE") => void;
  almacenId: string;
  onAlmacen: (id: string) => void;
  categoryId: string;
  onCategory: (id: string) => void;
  marcaId: string;
  onMarca: (id: string) => void;
  orden: OrdenExistencias;
  onOrden: (orden: OrdenExistencias) => void;
  abiertoId: string | null;
  onOpen: (row: StockResumenRow) => void;
}) {
  const [columnas, setColumnas] = useState<ColumnaOpcional[]>([]);
  const [menuColumnas, setMenuColumnas] = useState(false);
  // El menú se abre hacia el lado que tenga espacio: a la derecha del botón, salvo que se salga de la pantalla.
  const [menuAlDerecho, setMenuAlDerecho] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const guardadas = JSON.parse(localStorage.getItem(STORAGE_COLUMNAS) ?? "[]");
      if (Array.isArray(guardadas)) setColumnas(guardadas.filter((c): c is ColumnaOpcional => COLUMNAS_OPCIONALES.some((o) => o.id === c)));
    } catch {
      // Sin preferencias guardadas (o el navegador no deja leerlas): se usan las columnas de siempre.
    }
  }, []);

  useEffect(() => {
    function alClickAfuera(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuColumnas(false);
    }
    document.addEventListener("mousedown", alClickAfuera);
    return () => document.removeEventListener("mousedown", alClickAfuera);
  }, []);

  function alternarColumna(id: ColumnaOpcional) {
    setColumnas((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      try {
        localStorage.setItem(STORAGE_COLUMNAS, JSON.stringify(next));
      } catch {
        // Solo es una preferencia: si no se puede guardar, igual rige en esta visita.
      }
      return next;
    });
  }

  // --- categorías: hijas por padre, conteo propio y acumulado (la propia más sus descendientes) ---
  const hijasDe = useMemo(() => {
    const mapa = new Map<string, Category[]>();
    for (const c of categories) {
      if (c.parentId) mapa.set(c.parentId, [...(mapa.get(c.parentId) ?? []), c]);
    }
    return mapa;
  }, [categories]);

  const descendientes = (id: string): string[] => [id, ...(hijasDe.get(id) ?? []).flatMap((h) => descendientes(h.id))];
  const conteoPropio = new Map((page?.categorias ?? []).map((c) => [c.categoryId, c]));
  const conteoDe = (id: string) => descendientes(id).reduce((n, d) => n + (conteoPropio.get(d)?.productos ?? 0), 0);
  const totalProductos = (page?.categorias ?? []).reduce((n, c) => n + c.productos, 0);

  const raices = categories.filter((c) => c.parentId === null).sort((a, b) => a.orden - b.orden || a.name.localeCompare(b.name));
  const seleccionada = categories.find((c) => c.id === categoryId) ?? null;
  const raizSeleccionada = seleccionada ? (seleccionada.parentId ? (categories.find((c) => c.id === seleccionada.parentId) ?? seleccionada) : seleccionada) : null;
  const subcategorias = raizSeleccionada ? (hijasDe.get(raizSeleccionada.id) ?? []).filter((c) => conteoDe(c.id) > 0 || c.id === categoryId) : [];

  // Marcas: las enlazadas a la categoría elegida (o a alguna de sus hijas); sin categoría, todas.
  const marcas = categoryId
    ? brands.filter((b) => b.categories.some((bc) => descendientes(categoryId).includes(bc.categoryId)))
    : brands;

  const ordenActual = ORDENES.findIndex((o) => o.valor.key === orden.key && o.valor.dir === orden.dir);

  function clickEncabezado(key: StockOrden, primera: "asc" | "desc" = "desc") {
    if (orden.key === key) onOrden({ key, dir: orden.dir === "asc" ? "desc" : "asc" });
    else onOrden({ key, dir: primera });
  }

  const ver = (id: ColumnaOpcional) => columnas.includes(id);
  const hayFiltros = Boolean(estado || almacenId || categoryId || marcaId || searchInput);

  function limpiar() {
    onEstado("");
    onAlmacen("");
    onCategory("");
    onMarca("");
    onSearchInput("");
  }

  return (
    <>
      <div className="ex-toolbar">
        <label className="ex-search">
          {ICONO_BUSCAR}
          <input
            type="search"
            placeholder="Buscar por producto, marca o código…"
            aria-label="Buscar existencias"
            value={searchInput}
            onChange={(e) => onSearchInput(e.target.value)}
          />
        </label>

        <div className="seg" role="group" aria-label="Disponibilidad">
          {(
            [
              ["", "Todos"],
              ["CON_DISPONIBLE", "Con disponible"],
              ["SIN_DISPONIBLE", "Sin disponible"],
            ] as const
          ).map(([valor, etiqueta]) => (
            <button key={valor} type="button" className={estado === valor ? "on" : undefined} onClick={() => onEstado(valor)}>
              {etiqueta}
            </button>
          ))}
        </div>

        <Selector etiqueta="Almacén" texto={almacenes.find((a) => a.id === almacenId)?.nombre ?? "Todos"} activo={Boolean(almacenId)} valor={almacenId} onChange={onAlmacen}>
          <option value="">Todos</option>
          {almacenes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </Selector>

        <Selector etiqueta="Marca" texto={brands.find((b) => b.id === marcaId)?.name ?? "Todas"} activo={Boolean(marcaId)} valor={marcaId} onChange={onMarca}>
          <option value="">Todas</option>
          {marcas.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Selector>

        <Selector
          etiqueta="Orden"
          texto={ordenActual >= 0 ? ORDENES[ordenActual].label : "Por columna"}
          valor={ordenActual >= 0 ? ordenActual : -1}
          onChange={(v) => {
            const elegido = ORDENES[Number(v)];
            if (elegido) onOrden(elegido.valor);
          }}
        >
          {ordenActual < 0 && <option value={-1}>Por columna</option>}
          {ORDENES.map((o, i) => (
            <option key={o.label} value={i}>
              {o.label}
            </option>
          ))}
        </Selector>

        <div className="ex-menu" ref={menuRef}>
          <button type="button" className="ex-btn" aria-haspopup="true" aria-expanded={menuColumnas} onClick={() => {
              const caja = menuRef.current?.getBoundingClientRect();
              setMenuAlDerecho(Boolean(caja && caja.left + 250 > window.innerWidth - 16));
              setMenuColumnas((v) => !v);
            }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16M15 4v16" />
            </svg>
            Columnas
          </button>
          {menuColumnas && (
            <div className={`ex-menu-panel${menuAlDerecho ? " ex-menu-panel--der" : ""}`} role="group" aria-label="Columnas visibles">
              <p>Mostrar además</p>
              {COLUMNAS_OPCIONALES.map((c) => (
                <label key={c.id}>
                  <input type="checkbox" checked={ver(c.id)} onChange={() => alternarColumna(c.id)} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ex-chips" role="group" aria-label="Categoría">
        <span className="ex-chips-label">Categoría</span>
        <button type="button" className={`ex-chip${!categoryId ? " ex-chip--on" : ""}`} onClick={() => onCategory("")}>
          Todas <b>{totalProductos}</b>
        </button>
        {raices
          .filter((c) => conteoDe(c.id) > 0 || c.id === raizSeleccionada?.id)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              className={`ex-chip${raizSeleccionada?.id === c.id ? " ex-chip--on" : ""}`}
              onClick={() => onCategory(c.id)}
            >
              {c.name} <b>{conteoDe(c.id)}</b>
            </button>
          ))}
      </div>
      {raizSeleccionada && subcategorias.length > 0 && (
        <div className="ex-chips ex-chips--sub" role="group" aria-label={`Subcategorías de ${raizSeleccionada.name}`}>
          <span className="ex-chips-label">{raizSeleccionada.name}</span>
          <button type="button" className={`ex-chip${categoryId === raizSeleccionada.id ? " ex-chip--on" : ""}`} onClick={() => onCategory(raizSeleccionada.id)}>
            Todas <b>{conteoDe(raizSeleccionada.id)}</b>
          </button>
          {subcategorias.map((c) => (
            <button key={c.id} type="button" className={`ex-chip${categoryId === c.id ? " ex-chip--on" : ""}`} onClick={() => onCategory(c.id)}>
              {c.name} <b>{conteoDe(c.id)}</b>
            </button>
          ))}
        </div>
      )}

      {loading && !page ? (
        <p className="cell-muted">Cargando...</p>
      ) : !page || page.items.length === 0 ? (
        <div className="ex-vacio">
          <p>No hay existencias para estos filtros.</p>
          {hayFiltros && (
            <button type="button" className="link-button" onClick={limpiar}>
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="ex-tabla table-scroll">
          <table className="table table-minimal">
            <thead>
              <tr>
                <Th k="producto" orden={orden} onSort={clickEncabezado} primera="asc">
                  Producto
                </Th>
                <Th k="categoria" orden={orden} onSort={clickEncabezado} primera="asc">
                  Categoría
                </Th>
                <th>Estado del stock</th>
                <Th k="disponible" orden={orden} onSort={clickEncabezado} num>
                  Disponible
                </Th>
                {ver("reservada") && (
                  <Th k="reservada" orden={orden} onSort={clickEncabezado} num>
                    Reservada
                  </Th>
                )}
                <Th k="fisica" orden={orden} onSort={clickEncabezado} num>
                  Física
                </Th>
                <Th k="transito" orden={orden} onSort={clickEncabezado} num>
                  En tránsito
                </Th>
                {ver("transitoDisp") && <th className="num">Disp. en tránsito</th>}
                {ver("transitoRes") && <th className="num">Reserv. de tránsito</th>}
                <Th k="valor" orden={orden} onSort={clickEncabezado} num>
                  Valor Bs
                </Th>
                {ver("almacenes") && (
                  <Th k="almacenes" orden={orden} onSort={clickEncabezado} num>
                    Alm.
                  </Th>
                )}
              </tr>
            </thead>
            <tbody>
              {page.items.map((row) => {
                const etiqueta = atributosLabel(row);
                const ml = row.variante.unidad === "ML" ? " ml" : "";
                const total = Math.max(1, row.cantidadFisica + row.cantidadEnTransito);
                const disponibleTransito = Math.max(0, row.cantidadEnTransito - row.cantidadReservadaTransito);
                const est = estadoDe(row);
                const imagen = productImageSrc(row.variante.product.imageUrl);
                const marca = row.variante.product.brand?.name;
                return (
                  <tr
                    key={row.varianteId}
                    className={`ex-fila${abiertoId === row.varianteId ? " ex-fila--abierta" : ""}`}
                    tabIndex={0}
                    aria-label={`Ver el detalle de ${row.variante.product.name}`}
                    onClick={() => onOpen(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(row);
                      }
                    }}
                  >
                    <td>
                      <div className="ex-prod">
                        <div className="ex-thumb">{imagen ? <img src={imagen} alt="" loading="lazy" /> : iniciales(row.variante.product.name)}</div>
                        <div className="ex-prod-txt">
                          {marca && <span className="ex-prod-marca">{marca}</span>}
                          <strong>{row.variante.product.name}</strong>
                          {etiqueta && <span className="ex-prod-attr">{etiqueta}</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="ex-tag">{row.variante.product.category.name}</span>
                    </td>
                    <td>
                      <div className="ex-bar" aria-hidden="true">
                        <i style={{ width: `${(Math.max(0, row.disponible) / total) * 100}%` }} />
                        <i style={{ width: `${(row.cantidadReservada / total) * 100}%` }} />
                        <i style={{ width: `${(row.cantidadEnTransito / total) * 100}%` }} />
                      </div>
                      <span className={`ex-estado ex-estado--${est.tono}`}>{est.texto}</span>
                    </td>
                    <td className="num">
                      <span className={`ex-disp ex-disp--${est.tono === "ok" || est.tono === "info" ? "ok" : est.tono}`}>
                        {row.disponible}
                        {ml}
                      </span>
                    </td>
                    {ver("reservada") && (
                      <td className="num cell-muted">
                        {row.cantidadReservada}
                        {ml}
                      </td>
                    )}
                    <td className="num cell-muted">
                      {row.cantidadFisica}
                      {ml}
                    </td>
                    <td className="num">{row.cantidadEnTransito > 0 ? <span className="ex-transito">{row.cantidadEnTransito}</span> : <span className="cell-muted">—</span>}</td>
                    {ver("transitoDisp") && <td className="num">{disponibleTransito > 0 ? disponibleTransito : <span className="cell-muted">—</span>}</td>}
                    {ver("transitoRes") && (
                      <td className="num">{row.cantidadReservadaTransito > 0 ? Math.min(row.cantidadReservadaTransito, row.cantidadEnTransito) : <span className="cell-muted">—</span>}</td>
                    )}
                    <td className="num cell-muted">{bs(row.valorBs)}</td>
                    {ver("almacenes") && <td className="num cell-muted">{row.almacenes}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
