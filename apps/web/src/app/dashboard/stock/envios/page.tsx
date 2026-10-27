"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, createEnvio, downloadEnvioPdf, getAlmacenes, getCategories, getEnvios, getEnviosDisponibles, getProveedores } from "../../../../lib/api";
import type { Almacen, Category, EnvioDisponible, EnvioResumen, EstadoEnvio, Page, Proveedor } from "../../../../lib/types";
import { Modal } from "../../../../components/Modal";
import { AlmacenSelector, ProveedorSelector } from "../../../../components/proformas/selectors";
import { ESTADO_ENVIO_CLASE, ESTADO_ENVIO_LABEL } from "../../../../lib/envio-estados";

// 10 envíos por página: cada uno se puede desplegar y muestra todo su contenido.
const PAGE_SIZE = 10;

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

function nombreVariante(v: EnvioDisponible["variante"]): string {
  const opciones = v.options.map((o) => o.optionValue.value).join(", ");
  return `${v.product.brand?.name ? `${v.product.brand.name} · ` : ""}${v.product.name}${opciones ? ` — ${opciones}` : ""}`;
}

function EnviosContenido() {
  const router = useRouter();
  const params = useSearchParams();
  const [estado, setEstado] = useState<"" | EstadoEnvio>("");
  const [categoryId, setCategoryId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [almacenFiltroId, setAlmacenFiltroId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [descargandoId, setDescargandoId] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [data, setData] = useState<Page<EnvioResumen> | null>(null);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [disponibles, setDisponibles] = useState<EnvioDisponible[] | null>(null);
  const [almacenId, setAlmacenId] = useState("");
  const [nota, setNota] = useState("");
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getEnvios({
      estado: estado || undefined,
      categoryId: categoryId || undefined,
      proveedorId: proveedorId || undefined,
      almacenId: almacenFiltroId || undefined,
      search: search || undefined,
      page: pageNum,
      limit: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [estado, categoryId, proveedorId, almacenFiltroId, search, pageNum]);

  useEffect(() => {
    getCategories().then((c) => setCategorias(c.filter((x) => x.parentId === null))).catch(() => {});
    getProveedores({ activo: "true", pageSize: 500 }).then((p) => setProveedores(p.items)).catch(() => {});
    getAlmacenes({ pageSize: 200 }).then((p) => setAlmacenes(p.items.filter((a) => a.activo))).catch(() => {});
  }, []);

  // Búsqueda por producto o marca con debounce.
  useEffect(() => {
    if (searchInput.trim() === search) return;
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPageNum(1);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function alternar(id: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function descargar(envio: EnvioResumen) {
    setDescargandoId(envio.id);
    try {
      await downloadEnvioPdf(envio.id, envio.codigo);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setDescargandoId(null);
    }
  }

  function limpiar() {
    setEstado("");
    setCategoryId("");
    setProveedorId("");
    setAlmacenFiltroId("");
    setSearchInput("");
    setSearch("");
    setPageNum(1);
  }

  const hayFiltros = Boolean(estado || categoryId || proveedorId || almacenFiltroId || search);

  function openModal() {
    setFormError("");
    setNota("");
    setCantidades({});
    setDisponibles(null);
    setModalOpen(true);
    getAlmacenes({ pageSize: 200 })
      .then((page) => {
        const activos = page.items.filter((a) => a.activo);
        setAlmacenes(activos);
        setAlmacenId((prev) => prev || (activos.find((a) => a.predeterminado) ?? activos[0])?.id || "");
      })
      .catch(() => {});
    getEnviosDisponibles()
      .then(setDisponibles)
      .catch((e) => setFormError(e instanceof Error ? e.message : String(e)));
  }

  // Llegar con ?nuevo=1 (desde una compra o el panel) abre directo el armado de envío.
  useEffect(() => {
    if (params.get("nuevo") === "1") {
      openModal();
      router.replace("/dashboard/stock/envios");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!almacenId) {
      setFormError("Elegí el almacén al que llega el envío.");
      return;
    }
    const items = Object.entries(cantidades)
      .filter(([, c]) => c > 0)
      .map(([compraDetalleId, cantidad]) => ({ compraDetalleId, cantidad }));
    setSubmitting(true);
    try {
      const envio = await createEnvio({ almacenDestinoId: almacenId, nota: nota.trim() || undefined, items });
      router.push(`/dashboard/stock/envios/${envio.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : String(err));
      setSubmitting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const elegidas = Object.values(cantidades).reduce((n, c) => n + c, 0);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Envíos</h1>
        <button type="button" className="btn-cta" onClick={openModal}>
          <span className="btn-cta-icon">+</span> Nuevo envío
        </button>
      </div>
      <p className="cell-muted" style={{ marginTop: -8, marginBottom: 16, fontSize: 13 }}>
        Un envío agrupa los productos ya recogidos (de una o varias compras y proveedores) que viajan juntos. Puede llegar por partes: lo que
        no llegó sigue en camino y las compras se completan cuando llegó todo.
      </p>

      <div className="filters-bar">
        <div className="filter-field">
          <label className="filter-label">Categoría</label>
          <select className="field" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPageNum(1); }}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label className="filter-label">Estado</label>
          <div className="seg" role="group" aria-label="Estado del envío">
            {([["", "Todos"], ...(Object.keys(ESTADO_ENVIO_LABEL) as EstadoEnvio[]).map((k) => [k, ESTADO_ENVIO_LABEL[k]])] as [string, string][]).map(([valor, etiqueta]) => (
              <button key={valor} type="button" className={estado === valor ? "on" : undefined} onClick={() => { setEstado(valor as "" | EstadoEnvio); setPageNum(1); }}>
                {etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-field" style={{ minWidth: 200 }}>
          <label className="filter-label">Proveedor</label>
          <ProveedorSelector options={proveedores} value={proveedorId} placeholder="Todos" onChange={(id) => { setProveedorId(id); setPageNum(1); }} />
        </div>

        <div className="filter-field" style={{ minWidth: 220, flex: 1 }}>
          <label className="filter-label">Producto o marca</label>
          <input className="field" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Nombre, código o marca" />
        </div>

        <div className="filter-field">
          <label className="filter-label">Almacén destino</label>
          <select className="field" value={almacenFiltroId} onChange={(e) => { setAlmacenFiltroId(e.target.value); setPageNum(1); }}>
            <option value="">Todos</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        {hayFiltros && (
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="button" className="link-button" onClick={limpiar}>
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {!data && !error && <p>Cargando...</p>}
      {data && data.items.length === 0 && <p>No hay envíos con estos filtros.</p>}
      {data && data.items.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
            <button
              type="button"
              className="link-button"
              onClick={() => setAbiertos(data.items.every((e) => abiertos.has(e.id)) ? new Set() : new Set(data.items.map((e) => e.id)))}
            >
              {data.items.every((e) => abiertos.has(e.id)) ? "Contraer todo" : "Expandir todo"}
            </button>
          </div>
          <div className="table-scroll">
            <table className="table table-minimal table-compact">
              <thead>
                <tr>
                  <th>Envío</th>
                  <th>Estado</th>
                  <th>Almacén destino</th>
                  <th>Compras</th>
                  <th className="num">Productos</th>
                  <th className="num">Llegaron</th>
                  <th>Salió</th>
                  <th>Recibido</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((envio) => {
                  const total = envio.items.reduce((n, i) => n + i.cantidad, 0);
                  const recibidas = envio.items.reduce((n, i) => n + i.cantidadRecibida, 0);
                  const compras = Array.from(new Set(envio.items.map((i) => i.compraDetalle.proforma.codigo)));
                  const abierto = abiertos.has(envio.id);
                  return (
                    <Fragment key={envio.id}>
                      <tr className="reg-group" aria-expanded={abierto} onClick={() => alternar(envio.id)} style={{ cursor: "pointer" }}>
                        <td className="reg-group-code">
                          <span className="reg-chevron">{abierto ? "▾" : "▸"}</span>
                          <Link href={`/dashboard/stock/envios/${envio.id}`} className="link-button" onClick={(e) => e.stopPropagation()}>
                            {envio.codigo}
                          </Link>
                        </td>
                        <td>
                          <span className={`badge ${ESTADO_ENVIO_CLASE[envio.estado]}`}>{ESTADO_ENVIO_LABEL[envio.estado]}</span>
                        </td>
                        <td className="cell-muted" style={{ fontWeight: 400 }}>{envio.almacenDestino.nombre}</td>
                        <td className="cell-muted" style={{ fontWeight: 400 }}>{compras.length > 0 ? compras.join(", ") : "—"}</td>
                        <td className="num">{total}</td>
                        <td className="num">
                          {recibidas} de {total}
                        </td>
                        <td className="cell-muted" style={{ fontWeight: 400 }}>{formatDate(envio.fechaEnvio)}</td>
                        <td className="cell-muted" style={{ fontWeight: 400 }}>{formatDate(envio.fechaRecepcion)}</td>
                      </tr>
                      {abierto && (
                        <tr>
                          <td colSpan={8} style={{ padding: "4px 12px 14px 34px" }}>
                            <table className="table table-minimal table-compact">
                              <thead>
                                <tr>
                                  <th>Marca</th>
                                  <th style={{ minWidth: 220 }}>Producto</th>
                                  <th>Compra</th>
                                  <th>Proveedor</th>
                                  <th className="num">Cant.</th>
                                  <th className="num">Llegaron</th>
                                  <th className="num">Faltan</th>
                                </tr>
                              </thead>
                              <tbody>
                                {envio.items.map((i) => {
                                  const v = i.compraDetalle.variante;
                                  const opciones = v.options.map((o) => o.optionValue.value).join(", ");
                                  const falta = i.cantidad - i.cantidadRecibida;
                                  return (
                                    <tr key={i.id}>
                                      <td className="cell-muted">{v.product.brand?.name ?? "—"}</td>
                                      <td className="cell-primary">
                                        {v.product.name}
                                        {opciones && <span className="cell-muted" style={{ fontWeight: 400 }}> — {opciones}</span>}
                                      </td>
                                      <td>
                                        <Link href={`/dashboard/proformas/${i.compraDetalle.proforma.id}`} className="link-button">
                                          {i.compraDetalle.proforma.codigo}
                                        </Link>
                                      </td>
                                      <td className="cell-muted">{i.compraDetalle.proveedor?.nombre ?? "—"}</td>
                                      <td className="num">{i.cantidad}</td>
                                      <td className="num">{i.cantidadRecibida}</td>
                                      <td className="num">{falta > 0 ? <span className="badge badge-warn">{falta}</span> : <span className="cell-muted">—</span>}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={4} className="cell-muted" style={{ textAlign: "right", fontWeight: 600 }}>
                                    Total de unidades
                                  </td>
                                  <td className="num cell-primary">{total}</td>
                                  <td className="num cell-primary">{recibidas}</td>
                                  <td className="num cell-primary">{total - recibidas > 0 ? total - recibidas : "—"}</td>
                                </tr>
                              </tfoot>
                            </table>
                            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
                              {envio.nota && <span className="cell-muted" style={{ fontSize: 12.5 }}>Nota: {envio.nota}</span>}
                              {envio.notaPie && <span className="cell-muted" style={{ fontSize: 12.5 }}>Pie del PDF: {envio.notaPie}</span>}
                              <span style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                                <button type="button" className="action-btn" disabled={descargandoId === envio.id} onClick={() => descargar(envio)}>
                                  {descargandoId === envio.id ? "Generando..." : "Descargar PDF"}
                                </button>
                                <Link href={`/dashboard/stock/envios/${envio.id}`} className="action-btn">
                                  Abrir envío
                                </Link>
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data && data.items.length > 0 && totalPages > 1 && (
        <div className="pagination">
          <button type="button" className={`pagination-btn${pageNum <= 1 ? " disabled" : ""}`} disabled={pageNum <= 1} onClick={() => setPageNum((p) => p - 1)}>
            ← Anterior
          </button>
          <span className="pagination-info">
            Página {pageNum} de {totalPages}
          </span>
          <button type="button" className={`pagination-btn${pageNum >= totalPages ? " disabled" : ""}`} disabled={pageNum >= totalPages} onClick={() => setPageNum((p) => p + 1)}>
            Siguiente →
          </button>
        </div>
      )}

      {modalOpen && (
        <Modal title="Nuevo envío" onClose={() => setModalOpen(false)} maxWidth={720}>
          <form className="form-grid" onSubmit={handleCreate}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 220 }}>
                <label>Almacén destino</label>
                <AlmacenSelector options={almacenes} value={almacenId} onChange={setAlmacenId} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label>Nota (opcional)</label>
                <input className="field" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. carga de octubre" />
              </div>
            </div>
            <div>
              <label>Productos recogidos para enviar (podés sumar más después)</label>
              {disponibles === null ? (
                <p className="cell-muted" style={{ fontSize: 13 }}>Cargando...</p>
              ) : disponibles.length === 0 ? (
                <p className="cell-muted" style={{ fontSize: 13 }}>
                  No hay productos recogidos sin enviar. Registrá un recojo en la compra (<Link href="/dashboard/registros?tab=COMPRA">Registros</Link>).
                </p>
              ) : (
                <div className="table-scroll" style={{ maxHeight: 300, overflowY: "auto" }}>
                  <table className="table table-minimal table-compact">
                    <thead>
                      <tr>
                        <th>Compra</th>
                        <th>Proveedor</th>
                        <th style={{ minWidth: 200 }}>Producto</th>
                        <th className="num">Recogidas sin enviar</th>
                        <th className="num">Enviar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disponibles.map((l) => (
                        <tr key={l.id}>
                          <td>{l.proforma.codigo}</td>
                          <td className="cell-muted">{l.proveedor?.nombre ?? l.proforma.proveedor?.nombre ?? "—"}</td>
                          <td className="cell-primary">{nombreVariante(l.variante)}</td>
                          <td className="num">{l.disponible}</td>
                          <td className="num">
                            <input
                              className="field"
                              type="number"
                              min={0}
                              max={l.disponible}
                              value={cantidades[l.id] ?? 0}
                              aria-label={`Unidades de ${l.variante.product.name} a enviar`}
                              onChange={(e) => {
                                const n = Math.max(0, Math.min(l.disponible, parseInt(e.target.value, 10) || 0));
                                setCantidades((prev) => ({ ...prev, [l.id]: n }));
                                // El envío va al almacén destino de las compras que lleva.
                                if (n > 0 && l.proforma.almacenId) setAlmacenId(l.proforma.almacenId);
                              }}
                              style={{ width: 80, textAlign: "center" }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {disponibles && disponibles.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 14, alignItems: "center" }}>
                  <button type="button" className="link-button" onClick={() => setCantidades(Object.fromEntries(disponibles.map((l) => [l.id, l.disponible])))}>
                    Enviar todo lo recogido
                  </button>
                  <span className="cell-muted" style={{ fontSize: 12.5 }}>{elegidas} unidades elegidas</span>
                </div>
              )}
            </div>
            {formError && <p className="error-text">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="button" disabled={submitting}>
                {submitting ? "Creando..." : "Crear envío"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function EnviosPage() {
  return (
    <Suspense fallback={<div className="card"><p>Cargando...</p></div>}>
      <EnviosContenido />
    </Suspense>
  );
}
