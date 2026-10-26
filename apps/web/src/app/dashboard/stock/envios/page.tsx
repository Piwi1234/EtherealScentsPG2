"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, createEnvio, getAlmacenes, getEnvios, getEnviosDisponibles } from "../../../../lib/api";
import type { Almacen, EnvioDisponible, EnvioResumen, EstadoEnvio, Page } from "../../../../lib/types";
import { Modal } from "../../../../components/Modal";
import { AlmacenSelector } from "../../../../components/proformas/selectors";
import { ESTADO_ENVIO_CLASE, ESTADO_ENVIO_LABEL } from "../../../../lib/envio-estados";

const PAGE_SIZE = 20;

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
    getEnvios({ estado: estado || undefined, page: pageNum, limit: PAGE_SIZE })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [estado, pageNum]);

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
        setAlmacenId((prev) => prev || activos[0]?.id || "");
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
          <label className="filter-label">Estado</label>
          <select
            className="field"
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value as "" | EstadoEnvio);
              setPageNum(1);
            }}
          >
            <option value="">Todos</option>
            {(Object.keys(ESTADO_ENVIO_LABEL) as EstadoEnvio[]).map((s) => (
              <option key={s} value={s}>
                {ESTADO_ENVIO_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!data && !error && <p>Cargando...</p>}
      {data && data.items.length === 0 && <p>No hay envíos todavía.</p>}
      {data && data.items.length > 0 && (
        <div className="table-scroll">
          <table className="table table-minimal table-compact">
            <thead>
              <tr>
                <th>Código</th>
                <th>Estado</th>
                <th>Almacén destino</th>
                <th>Compras</th>
                <th className="num">Llegaron</th>
                <th>Salió</th>
                <th>Recibido</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((envio) => {
                const total = envio.items.reduce((n, i) => n + i.cantidad, 0);
                const recibidas = envio.items.reduce((n, i) => n + i.cantidadRecibida, 0);
                const compras = Array.from(new Set(envio.items.map((i) => i.compraDetalle.proforma.codigo)));
                return (
                  <tr key={envio.id} onClick={() => router.push(`/dashboard/stock/envios/${envio.id}`)} style={{ cursor: "pointer" }}>
                    <td className="cell-primary">{envio.codigo}</td>
                    <td>
                      <span className={`badge ${ESTADO_ENVIO_CLASE[envio.estado]}`}>{ESTADO_ENVIO_LABEL[envio.estado]}</span>
                    </td>
                    <td className="cell-muted">{envio.almacenDestino.nombre}</td>
                    <td className="cell-muted">{compras.length > 0 ? compras.join(", ") : "—"}</td>
                    <td className="num">
                      {recibidas} de {total}
                    </td>
                    <td className="cell-muted">{formatDate(envio.fechaEnvio)}</td>
                    <td className="cell-muted">{formatDate(envio.fechaRecepcion)}</td>
                    <td className="cell-muted">{envio.nota ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
                              onChange={(e) => setCantidades((prev) => ({ ...prev, [l.id]: Math.max(0, Math.min(l.disponible, parseInt(e.target.value, 10) || 0)) }))}
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
