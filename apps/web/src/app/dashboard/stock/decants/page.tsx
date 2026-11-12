"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TAMANOS_DECANT_ML } from "@app/shared";
import {
  ApiError,
  darBajaMl,
  deshacerConversionDecant,
  getAlmacenes,
  getDecantDetalle,
  getDecantUsuarios,
  getDecants,
  getMovimientosDecant,
} from "../../../../lib/api";
import type { Almacen, DecantDetalle, DecantPresentacionFila, DecantResumen, DecantResumenRespuesta, MovimientoDecant, MovimientosDecantRespuesta, ProbadorVariante } from "../../../../lib/types";
import { formatAtributosVisibles } from "../../../../components/proformas/AtributosVisibles";
import { Modal } from "../../../../components/Modal";
import { Selector } from "../../../../components/stock/ExistenciasLista";

const PAGE_SIZE = 15;

type Pestana = "stock" | "historial";
type Periodo = "" | "hoy" | "7" | "30" | "mes";

const PERIODOS: { valor: Periodo; texto: string }[] = [
  { valor: "", texto: "Todo" },
  { valor: "hoy", texto: "Hoy" },
  { valor: "7", texto: "Últimos 7 días" },
  { valor: "30", texto: "Últimos 30 días" },
  { valor: "mes", texto: "Este mes" },
];

const TIPOS: { valor: string; texto: string }[] = [
  { valor: "", texto: "Todos" },
  { valor: "CONVERSION", texto: "Convertidos" },
  { valor: "DESDE_PROBADOR", texto: "Desde probador" },
  { valor: "BAJA", texto: "Bajas de ml" },
];

const ESTADOS: { valor: string; texto: string }[] = [
  { valor: "", texto: "Todos" },
  { valor: "RESERVADOS", texto: "Con reservados" },
  { valor: "SIN_PRESENTACIONES", texto: "Sin presentaciones" },
];

function dia(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Rango de fechas (AAAA-MM-DD, inclusive) de un período rápido. */
function rangoDe(periodo: Periodo): { desde?: string; hasta?: string } {
  const hoy = new Date();
  if (periodo === "hoy") return { desde: dia(hoy), hasta: dia(hoy) };
  if (periodo === "7" || periodo === "30") {
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - (periodo === "7" ? 6 : 29));
    return { desde: dia(inicio), hasta: dia(hoy) };
  }
  if (periodo === "mes") return { desde: dia(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: dia(hoy) };
  return {};
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" });
}

function atributosLabel(variante: ProbadorVariante): string | null {
  const opciones = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(variante.product.attributeValues, variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

function Producto({ variante }: { variante: ProbadorVariante }) {
  const etiqueta = atributosLabel(variante);
  return (
    <>
      <span className="cell-muted" style={{ display: "block", fontSize: 11.5, fontWeight: 400 }}>{variante.product.brand?.name ?? ""}</span>
      {variante.product.name}
      {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
    </>
  );
}

const nf2 = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bs = (n: number | null) => (n === null ? "—" : `Bs ${nf2(n)}`);
const usd = (n: number | string) => `$ ${Number(n).toFixed(2)}`;

/** Precio por ml de las presentaciones activas: un valor o el rango "mín – máx". */
function precioPorMl(presentaciones: DecantPresentacionFila[]): string {
  const valores = presentaciones.filter((p) => p.activo).map((p) => Number(p.precioVentaBs) / p.cantidadMl);
  if (valores.length === 0) return "—";
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  return Math.abs(max - min) < 0.005 ? nf2(min) : `${nf2(min)} – ${nf2(max)}`;
}

const ETIQUETA_ORIGEN: Record<string, string> = { CONVERSION: "desde frascos", DESDE_PROBADOR: "desde probador", BAJA: "baja" };
const ETIQUETA_TIPO: Record<MovimientoDecant["tipo"], { texto: string; clase: string }> = {
  CONVERSION: { texto: "Convertido", clase: "badge badge-ok" },
  DESDE_PROBADOR: { texto: "Desde probador", clase: "badge badge-info" },
  BAJA: { texto: "Baja de ml", clase: "badge badge-warn" },
};

/**
 * Decants (gestión): dos pestañas. «Stock de ml» lista lo que hay con su costo y precio por ml y abre un panel lateral con
 * lotes, presentaciones y últimos movimientos; «Historial» trae los movimientos con filtros y totales. Las conversiones se
 * hacen desde Existencias (botón «Decants» del producto) y las presentaciones, desde la ficha del producto.
 */
export default function DecantsPage() {
  const [pestana, setPestana] = useState<Pestana>("stock");
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacenId, setAlmacenId] = useState("");
  const [error, setError] = useState("");
  const [accionError, setAccionError] = useState("");

  // Stock de ml
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [resumen, setResumen] = useState<DecantResumenRespuesta | null>(null);

  // Panel de detalle
  const [abierto, setAbierto] = useState<DecantResumen | null>(null);
  const [detalle, setDetalle] = useState<DecantDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  // Historial
  const [histSearchInput, setHistSearchInput] = useState("");
  const [histSearch, setHistSearch] = useState("");
  const [tipo, setTipo] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("");
  const [usuarioId, setUsuarioId] = useState("");
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([]);
  const [pagina, setPagina] = useState(1);
  const [movs, setMovs] = useState<MovimientosDecantRespuesta | null>(null);

  // Baja de ml
  const [baja, setBaja] = useState<DecantResumen | null>(null);
  const [bajaMl, setBajaMl] = useState("");
  const [bajaNota, setBajaNota] = useState("");
  const [bajaError, setBajaError] = useState("");
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    getAlmacenes({ pageSize: 200 })
      .then((p) => setAlmacenes(p.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getDecantUsuarios().then(setUsuarios).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = setTimeout(() => {
      setHistSearch(histSearchInput.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [histSearchInput]);

  const cargarStock = useCallback(() => {
    getDecants({ almacenId: almacenId || undefined, search: search || undefined, brandId: marcaId || undefined, estado: estado || undefined })
      .then(setResumen)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [almacenId, search, marcaId, estado]);

  const cargarHistorial = useCallback(() => {
    const { desde, hasta } = rangoDe(periodo);
    getMovimientosDecant({ almacenId: almacenId || undefined, tipo: tipo || undefined, usuarioId: usuarioId || undefined, search: histSearch || undefined, desde, hasta, page: pagina, pageSize: PAGE_SIZE })
      .then(setMovs)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [almacenId, tipo, usuarioId, histSearch, periodo, pagina]);

  useEffect(cargarStock, [cargarStock]);
  useEffect(cargarHistorial, [cargarHistorial]);

  function cargarTodo() {
    cargarStock();
    cargarHistorial();
    if (abierto) abrirPanel(abierto);
  }

  function abrirPanel(fila: DecantResumen) {
    setAbierto(fila);
    setCargandoDetalle(true);
    getDecantDetalle(fila.varianteId, fila.almacenId)
      .then(setDetalle)
      .catch((e) => setAccionError(e instanceof Error ? e.message : String(e)))
      .finally(() => setCargandoDetalle(false));
  }

  function cerrarPanel() {
    setAbierto(null);
    setDetalle(null);
  }

  function verHistorialDe(fila: DecantResumen) {
    setHistSearchInput(fila.variante.product.name);
    setHistSearch(fila.variante.product.name);
    setPagina(1);
    cerrarPanel();
    setPestana("historial");
  }

  function abrirBaja(fila: DecantResumen) {
    setBaja(fila);
    setBajaMl("");
    setBajaNota("");
    setBajaError("");
  }

  async function confirmarBaja() {
    if (!baja) return;
    const ml = parseInt(bajaMl, 10);
    if (!ml || ml < 1 || ml > baja.mlDisponibles) {
      setBajaError(`Los ml deben estar entre 1 y ${baja.mlDisponibles}.`);
      return;
    }
    setBajando(true);
    setBajaError("");
    try {
      await darBajaMl({ varianteId: baja.varianteId, almacenId: baja.almacenId, cantidadMl: ml, nota: bajaNota.trim() || undefined });
      setBaja(null);
      cerrarPanel();
      cargarStock();
      cargarHistorial();
    } catch (e) {
      setBajaError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBajando(false);
    }
  }

  async function deshacer(m: MovimientoDecant) {
    const que = m.tipo === "DESDE_PROBADOR" ? `Los probadores vuelven al conteo y se quitan ${m.cantidadMl} ml.` : `Los frascos vuelven al stock y se quitan ${m.cantidadMl} ml.`;
    if (!confirm(`¿Deshacer este movimiento? ${que}`)) return;
    setAccionError("");
    try {
      await deshacerConversionDecant(m.id);
      cargarTodo();
    } catch (e) {
      setAccionError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  const hayFiltrosStock = Boolean(almacenId || searchInput || estado || marcaId);
  const hayFiltrosHist = Boolean(almacenId || histSearchInput || tipo || periodo || usuarioId);
  const totalPaginas = movs ? Math.max(1, Math.ceil(movs.total / movs.pageSize)) : 1;
  const items = resumen?.items ?? [];

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  const selectorAlmacen = (
    <Selector etiqueta="Almacén" texto={almacenes.find((a) => a.id === almacenId)?.nombre ?? "Todos"} activo={Boolean(almacenId)} valor={almacenId} onChange={(v) => { setAlmacenId(v); setPagina(1); }}>
      <option value="">Todos</option>
      {almacenes.map((a) => (
        <option key={a.id} value={a.id}>
          {a.nombre}
        </option>
      ))}
    </Selector>
  );

  return (
    <div className="card">
      <div className="ex-head">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 20 }}>Decants</h1>
          <p className="cell-muted" style={{ margin: 0, fontSize: 13 }}>
            Stock de ml y el historial de lo que entró y salió. Para convertir frascos, ve a Existencias, abre el perfume y usa «Decants».
          </p>
        </div>
      </div>

      <div className="dg-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === "stock"} className={`dg-tab${pestana === "stock" ? " dg-tab--on" : ""}`} onClick={() => setPestana("stock")}>
          <span>Stock de ml</span>
          <strong>{resumen ? items.length : "—"}</strong>
          <small>{resumen ? `perfume${items.length === 1 ? "" : "s"} · ${resumen.resumen.mlDisponibles} ml` : ""}</small>
        </button>
        <button type="button" role="tab" aria-selected={pestana === "historial"} className={`dg-tab${pestana === "historial" ? " dg-tab--on" : ""}`} onClick={() => setPestana("historial")}>
          <span>Historial</span>
          <strong>{movs ? movs.total : "—"}</strong>
          <small>movimiento{movs?.total === 1 ? "" : "s"}</small>
        </button>
      </div>

      {accionError && <p className="error-text">{accionError}</p>}

      {pestana === "stock" && (
        <>
          <div className="ex-toolbar">
            <label className="ex-search">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input type="search" placeholder="Buscar perfume o marca…" aria-label="Buscar decants" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </label>
            <div className="seg" role="group" aria-label="Estado">
              {ESTADOS.map((e) => (
                <button key={e.valor} type="button" className={estado === e.valor ? "on" : undefined} onClick={() => setEstado(e.valor)}>
                  {e.texto}
                </button>
              ))}
            </div>
            {selectorAlmacen}
            <Selector etiqueta="Marca" texto={resumen?.marcas.find((m) => m.id === marcaId)?.name ?? "Todas"} activo={Boolean(marcaId)} valor={marcaId} onChange={setMarcaId}>
              <option value="">Todas</option>
              {(resumen?.marcas ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Selector>
            {hayFiltrosStock && (
              <button type="button" className="link-button" onClick={() => { setAlmacenId(""); setSearchInput(""); setEstado(""); setMarcaId(""); }}>
                Limpiar
              </button>
            )}
          </div>

          {resumen && (
            <div className="ex-kpis" style={{ marginTop: 14 }}>
              <div><span>ml disponibles</span><strong>{resumen.resumen.mlDisponibles}</strong></div>
              <div><span>Valor del stock (costo)</span><strong>{bs(resumen.resumen.valorBs)}</strong></div>
              <div><span>Costo promedio por ml</span><strong>{bs(resumen.resumen.costoMlBs)}</strong></div>
              <div>
                <span>Sin presentaciones</span>
                <strong style={resumen.resumen.sinPresentaciones > 0 ? { color: "#c9a96e" } : undefined}>{resumen.resumen.sinPresentaciones}</strong>
                {resumen.resumen.sinPresentaciones > 0 && <small>no se pueden vender en la web</small>}
              </div>
            </div>
          )}

          {!resumen ? (
            <p className="cell-muted">Cargando...</p>
          ) : items.length === 0 ? (
            <div className="ex-vacio">
              <p>{hayFiltrosStock ? "Ningún decant coincide con estos filtros." : "No hay ml en stock."}</p>
            </div>
          ) : (
            <div className="ex-tabla">
              <div className="table-scroll">
                <table className="table table-minimal table-compact">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 220 }}>Producto</th>
                      <th>Almacén</th>
                      <th className="num">ml disp.</th>
                      <th className="num">Costo / ml</th>
                      <th className="num">Precio / ml</th>
                      <th>Presentaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => {
                      const activas = r.presentaciones.filter((p) => p.activo);
                      const sinPres = activas.length === 0;
                      return (
                        <tr
                          key={`${r.varianteId}-${r.almacenId}`}
                          className={`ex-fila${abierto?.varianteId === r.varianteId && abierto.almacenId === r.almacenId ? " ex-fila--abierta" : ""}`}
                          tabIndex={0}
                          aria-label={`Ver el detalle de ${r.variante.product.name}`}
                          onClick={() => abrirPanel(r)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              abrirPanel(r);
                            }
                          }}
                        >
                          <td className="cell-primary">
                            <Producto variante={r.variante} />
                          </td>
                          <td className="cell-muted">{r.almacen.nombre}</td>
                          <td className="num">
                            <strong>{r.mlDisponibles}</strong>
                            {r.mlReservados > 0 && <span className="ex-estado ex-estado--warn">{r.mlReservados} reservados</span>}
                          </td>
                          <td className="num">{bs(r.costoMlBs)}</td>
                          <td className="num">{precioPorMl(r.presentaciones)}</td>
                          <td>
                            {sinPres ? (
                              <span className="dg-sin">Sin presentaciones · no se vende</span>
                            ) : (
                              <span className="dg-chips">
                                {activas.map((p) => (
                                  <span className="dg-chip" key={p.id}>
                                    {p.cantidadMl} ml · Bs {Number(p.precioVentaBs)}
                                  </span>
                                ))}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="cell-muted" style={{ fontSize: 12, margin: "10px 0 0" }}>
            Costo/ml: promedio de los lotes de ml, en Bs, con el tipo de cambio de cada compra. Precio/ml: precio de cada presentación activa ÷ sus ml.
          </p>
        </>
      )}

      {pestana === "historial" && (
        <>
          <div className="ex-toolbar">
            <label className="ex-search">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input type="search" placeholder="Buscar perfume o marca…" aria-label="Buscar en el historial" value={histSearchInput} onChange={(e) => setHistSearchInput(e.target.value)} />
            </label>
            <div className="seg" role="group" aria-label="Tipo de movimiento">
              {TIPOS.map((t) => (
                <button key={t.valor} type="button" className={tipo === t.valor ? "on" : undefined} onClick={() => { setTipo(t.valor); setPagina(1); }}>
                  {t.texto}
                </button>
              ))}
            </div>
            <Selector etiqueta="Período" texto={PERIODOS.find((p) => p.valor === periodo)?.texto ?? "Todo"} activo={Boolean(periodo)} valor={periodo} onChange={(v) => { setPeriodo(v as Periodo); setPagina(1); }}>
              {PERIODOS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.texto}
                </option>
              ))}
            </Selector>
            <Selector etiqueta="Usuario" texto={usuarios.find((u) => u.id === usuarioId)?.nombre ?? "Todos"} activo={Boolean(usuarioId)} valor={usuarioId} onChange={(v) => { setUsuarioId(v); setPagina(1); }}>
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </Selector>
            {selectorAlmacen}
            {hayFiltrosHist && (
              <button type="button" className="link-button" onClick={() => { setAlmacenId(""); setHistSearchInput(""); setHistSearch(""); setTipo(""); setPeriodo(""); setUsuarioId(""); setPagina(1); }}>
                Limpiar
              </button>
            )}
          </div>

          {movs && (
            <div className="ex-kpis" style={{ marginTop: 14, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <div><span>ml que entraron</span><strong style={{ color: "#3fb68b" }}>+{movs.totales.mlEntraron}</strong></div>
              <div><span>ml perdidos (bajas)</span><strong style={movs.totales.mlPerdidos > 0 ? { color: "#e5675b" } : undefined}>−{movs.totales.mlPerdidos}</strong></div>
              <div><span>Costo de lo perdido</span><strong>{usd(movs.totales.costoPerdido)}</strong></div>
            </div>
          )}

          {!movs ? (
            <p className="cell-muted">Cargando...</p>
          ) : movs.items.length === 0 ? (
            <div className="ex-vacio">
              <p>{hayFiltrosHist ? "Ningún movimiento coincide con estos filtros." : "Todavía no hay movimientos."}</p>
            </div>
          ) : (
            <>
              <div className="ex-tabla">
                <div className="table-scroll">
                  <table className="table table-minimal table-compact">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Movimiento</th>
                        <th style={{ minWidth: 220 }}>Producto</th>
                        <th>Origen</th>
                        <th className="num">ml</th>
                        <th className="num">Costo $</th>
                        <th className="num">Valor / ml $</th>
                        <th>Usuario</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {movs.items.map((m) => {
                        const etiqueta = ETIQUETA_TIPO[m.tipo];
                        const costo = Number(m.costoTotal);
                        return (
                          <tr key={m.id} style={m.revertidoAt ? { opacity: 0.55 } : undefined}>
                            <td className="cell-muted">{formatDateTime(m.fecha)}</td>
                            <td>
                              <span className={etiqueta.clase}>{etiqueta.texto}</span>
                              {m.revertidoAt && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Deshecho</span>}
                            </td>
                            <td className="cell-primary">
                              <Producto variante={m.varianteOrigen ?? m.variante} />
                              {m.nota && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{m.nota}</div>}
                            </td>
                            <td className="cell-muted">
                              {m.tipo === "CONVERSION" ? `${m.cantidadFrascos} × ${m.mlPorFrasco} ml` : m.tipo === "DESDE_PROBADOR" ? `${m.cantidadFrascos} probador${m.cantidadFrascos === 1 ? "" : "es"}` : "—"}
                            </td>
                            <td className="num" style={{ fontWeight: 600, color: m.tipo === "BAJA" ? "#e5675b" : "#3fb68b" }}>
                              {m.tipo === "BAJA" ? "−" : "+"}
                              {m.cantidadMl}
                            </td>
                            <td className="num">{costo > 0 ? nf2(costo) : "—"}</td>
                            <td className="num">{costo > 0 ? (costo / m.cantidadMl).toFixed(3) : "—"}</td>
                            <td className="cell-muted">{m.creadoPor.nombre}</td>
                            <td>
                              {m.tipo !== "BAJA" && !m.revertidoAt && (
                                <button type="button" className="action-btn" onClick={() => deshacer(m)}>
                                  Deshacer
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {totalPaginas > 1 && (
                <div className="pagination">
                  <button type="button" className={`pagination-btn${pagina <= 1 ? " disabled" : ""}`} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                    ← Anterior
                  </button>
                  <span className="pagination-info">
                    Página {pagina} de {totalPaginas}
                  </span>
                  <button type="button" className={`pagination-btn${pagina >= totalPaginas ? " disabled" : ""}`} disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {abierto && (
        <>
          <div className="stock-overlay" onClick={cerrarPanel} />
          <aside className="exp-panel" role="dialog" aria-label={`Detalle de ${abierto.variante.product.name}`}>
            <header className="exp-head">
              <div className="exp-thumb">{abierto.variante.product.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}</div>
              <div className="exp-head-txt">
                <span>{[abierto.variante.product.brand?.name, abierto.almacen.nombre].filter(Boolean).join(" · ")}</span>
                <h2>{abierto.variante.product.name}</h2>
                {atributosLabel(abierto.variante) && <p>{atributosLabel(abierto.variante)}</p>}
              </div>
              <button type="button" className="exp-cerrar" aria-label="Cerrar" onClick={cerrarPanel}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </header>

            <div className="exp-body">
              <div className="exp-acciones" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <button type="button" className="exp-accion exp-accion--principal" disabled={abierto.mlDisponibles <= 0} onClick={() => abrirBaja(abierto)}>
                  Dar de baja ml
                </button>
                <button type="button" className="exp-accion" onClick={() => verHistorialDe(abierto)}>
                  Ver historial
                </button>
              </div>

              <div className="exp-kpis" style={{ marginTop: -10 }}>
                <div><span>Disponibles</span><strong>{abierto.mlDisponibles} ml</strong></div>
                <div><span>Reservados</span><strong>{abierto.mlReservados} ml</strong></div>
                <div><span>Costo por ml</span><strong>{bs(abierto.costoMlBs)}</strong></div>
                <div><span>Valor a costo</span><strong>{bs(abierto.valorBs)}</strong></div>
              </div>

              {cargandoDetalle || !detalle ? (
                <p className="cell-muted">Cargando...</p>
              ) : (
                <>
                  <section className="exp-sec">
                    <div className="exp-sec-head">
                      <h3>Presentaciones</h3>
                      <Link href={`/dashboard/products/${abierto.variante.product.id}/edit`} className="link-button" style={{ fontSize: 12.5 }}>
                        Gestionar
                      </Link>
                    </div>
                    {detalle.presentaciones.length === 0 ? (
                      <p className="exp-vacio">Sin presentaciones: estos ml no se pueden vender. Créalas desde «Gestionar».</p>
                    ) : (
                      <table className="table table-minimal table-compact dg-pres">
                        <thead>
                          <tr>
                            <th>Tamaño</th>
                            <th className="num">Precio</th>
                            <th className="num">Por ml</th>
                            <th className="num">Costo</th>
                            <th className="num">Margen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalle.presentaciones.map((p) => {
                            const costo = abierto.costoMlBs === null ? null : abierto.costoMlBs * p.cantidadMl + Number(p.costoEmpaqueBs);
                            const margen = costo === null ? null : Number(p.precioVentaBs) - costo;
                            return (
                              <tr key={p.id} style={p.activo ? undefined : { opacity: 0.5 }}>
                                <td>
                                  <strong>{p.cantidadMl} ml</strong>
                                  {!p.activo && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Inactiva</span>}
                                </td>
                                <td className="num">Bs {Number(p.precioVentaBs)}</td>
                                <td className="num">{nf2(Number(p.precioVentaBs) / p.cantidadMl)}</td>
                                <td className="num">{costo === null ? "—" : nf2(costo)}</td>
                                <td className="num" style={margen === null ? undefined : { fontWeight: 600, color: margen < 0 ? "#e5675b" : "#3fb68b" }}>
                                  {margen === null ? "—" : `${margen > 0 ? "+" : ""}${nf2(margen)}`}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    {(() => {
                      const libres = TAMANOS_DECANT_ML.filter((ml) => !detalle.presentaciones.some((p) => p.cantidadMl === ml));
                      return libres.length > 0 ? <p className="exp-sec-nota" style={{ marginTop: 8 }}>Tamaños sin crear: {libres.map((ml) => `${ml} ml`).join(", ")}.</p> : null;
                    })()}
                    <p className="exp-sec-nota" style={{ marginTop: 4 }}>Costo = ml × costo por ml + empaque. Margen = precio − costo.</p>
                  </section>

                  <section className="exp-sec">
                    <div className="exp-sec-head">
                      <h3>Lotes de ml</h3>
                    </div>
                    {detalle.lotes.length === 0 ? (
                      <p className="exp-vacio">Sin lotes con ml disponibles.</p>
                    ) : (
                      <div className="exp-lista">
                        {detalle.lotes.map((l) => (
                          <div className="dg-fila" key={l.id}>
                            <span>
                              {formatDate(l.fecha)}
                              <small>{l.origen ? ETIQUETA_ORIGEN[l.origen] : "—"}</small>
                            </span>
                            <span className="dg-fila-num">
                              <b>{l.cantidadDisponible}</b> de {l.cantidadInicial} ml
                              <small>{bs(l.costoMlBs)} / ml</small>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="exp-sec">
                    <div className="exp-sec-head">
                      <h3>Últimos movimientos</h3>
                    </div>
                    {detalle.movimientos.length === 0 ? (
                      <p className="exp-vacio">Sin movimientos.</p>
                    ) : (
                      <div className="exp-lista">
                        {detalle.movimientos.map((m) => (
                          <div className="dg-fila" key={m.id} style={m.revertidoAt ? { opacity: 0.55 } : undefined}>
                            <span>
                              {ETIQUETA_TIPO[m.tipo].texto}
                              {m.revertidoAt ? " (deshecho)" : ""}
                              <small>
                                {formatDateTime(m.fecha)} · {m.creadoPor.nombre}
                              </small>
                            </span>
                            <span className="dg-fila-num" style={{ color: m.tipo === "BAJA" ? "#e5675b" : "#3fb68b" }}>
                              <b>
                                {m.tipo === "BAJA" ? "−" : "+"}
                                {m.cantidadMl}
                              </b>{" "}
                              ml
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </aside>
        </>
      )}

      {baja && (
        <Modal title={`Dar de baja ml: ${baja.variante.product.name}`} onClose={() => setBaja(null)} maxWidth={440}>
          <div className="form-grid">
            <p className="cell-muted" style={{ margin: 0, fontSize: 13 }}>
              Para ml que se derramaron o se perdieron. Se descuentan del stock, de los lotes más antiguos primero.
            </p>
            <div>
              <label>ml a dar de baja (hay {baja.mlDisponibles} disponibles)</label>
              <input className="field" type="number" min={1} max={baja.mlDisponibles} value={bajaMl} onChange={(e) => setBajaMl(e.target.value)} />
            </div>
            <div>
              <label>Motivo (opcional)</label>
              <input className="field" value={bajaNota} maxLength={300} onChange={(e) => setBajaNota(e.target.value)} placeholder="Ej. derrame al decantar" />
            </div>
            {bajaError && <p className="error-text">{bajaError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setBaja(null)}>
                Cancelar
              </button>
              <button type="button" className="button" disabled={bajando} onClick={confirmarBaja}>
                {bajando ? "Guardando..." : "Dar de baja"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
