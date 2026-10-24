"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, createEnvio, getAlmacenes, getComprasDisponiblesParaEnvio, getEnvios } from "../../../../lib/api";
import type { Almacen, EnvioResumen, EstadoEnvio, Page, Proforma } from "../../../../lib/types";
import { Modal } from "../../../../components/Modal";
import { AlmacenSelector } from "../../../../components/proformas/selectors";
import { ESTADO_ENVIO_CLASE, ESTADO_ENVIO_LABEL } from "../../../../lib/envio-estados";

const PAGE_SIZE = 20;

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

function proveedoresDe(compra: Proforma): string {
  const nombres = Array.from(new Set(compra.detalles.map((d) => d.proveedor?.nombre).filter((n): n is string => Boolean(n))));
  return nombres.length > 0 ? nombres.join(", ") : "Sin proveedor";
}

export default function EnviosPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<"" | EstadoEnvio>("");
  const [pageNum, setPageNum] = useState(1);
  const [data, setData] = useState<Page<EnvioResumen> | null>(null);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [disponibles, setDisponibles] = useState<Proforma[]>([]);
  const [almacenId, setAlmacenId] = useState("");
  const [nota, setNota] = useState("");
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
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
    setSeleccionadas(new Set());
    setModalOpen(true);
    getAlmacenes({ pageSize: 200 })
      .then((page) => {
        const activos = page.items.filter((a) => a.activo);
        setAlmacenes(activos);
        setAlmacenId((prev) => prev || activos[0]?.id || "");
      })
      .catch(() => {});
    getComprasDisponiblesParaEnvio()
      .then(setDisponibles)
      .catch((e) => setFormError(e instanceof Error ? e.message : String(e)));
  }

  function toggleCompra(id: string) {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!almacenId) {
      setFormError("Elegí el almacén al que llega el envío.");
      return;
    }
    setSubmitting(true);
    try {
      const envio = await createEnvio({ almacenDestinoId: almacenId, nota: nota.trim() || undefined, compraIds: Array.from(seleccionadas) });
      router.push(`/dashboard/stock/envios/${envio.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : String(err));
      setSubmitting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Envíos</h1>
        <button type="button" className="btn-cta" onClick={openModal}>
          <span className="btn-cta-icon">+</span> Nuevo envío
        </button>
      </div>
      <p className="cell-muted" style={{ marginTop: -8, marginBottom: 16, fontSize: 13 }}>
        Un envío agrupa las compras (de uno o varios proveedores) que viajan juntas. Las compras se completan al confirmar la
        recepción del envío, corrigiendo lo que realmente llegó.
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
                <th className="num">Compras</th>
                <th>Salió</th>
                <th>Recibido</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((envio) => (
                <tr key={envio.id} onClick={() => router.push(`/dashboard/stock/envios/${envio.id}`)} style={{ cursor: "pointer" }}>
                  <td className="cell-primary">{envio.codigo}</td>
                  <td>
                    <span className={`badge ${ESTADO_ENVIO_CLASE[envio.estado]}`}>{ESTADO_ENVIO_LABEL[envio.estado]}</span>
                  </td>
                  <td className="cell-muted">{envio.almacenDestino.nombre}</td>
                  <td className="num">{envio.compras.length}</td>
                  <td className="cell-muted">{formatDate(envio.fechaEnvio)}</td>
                  <td className="cell-muted">{formatDate(envio.fechaRecepcion)}</td>
                  <td className="cell-muted">{envio.nota ?? "—"}</td>
                </tr>
              ))}
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
        <Modal title="Nuevo envío" onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <div>
              <label>Almacén destino</label>
              <AlmacenSelector options={almacenes} value={almacenId} onChange={setAlmacenId} />
            </div>
            <div>
              <label>Nota (opcional)</label>
              <input className="field" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. carga de octubre" />
            </div>
            <div>
              <label>Compras aprobadas para incluir (podés sumar más después)</label>
              {disponibles.length === 0 ? (
                <p className="cell-muted" style={{ fontSize: 13 }}>
                  No hay compras aprobadas sin envío. Aprobá una compra en <Link href="/dashboard/proformas?tipo=COMPRA">Proformas</Link>.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                  {disponibles.map((c) => (
                    <label key={c.id} className="checkbox-row" style={{ cursor: "pointer" }}>
                      <input type="checkbox" checked={seleccionadas.has(c.id)} onChange={() => toggleCompra(c.id)} />
                      {c.codigo} · {proveedoresDe(c)} · {c.detalles.length} línea{c.detalles.length === 1 ? "" : "s"}
                    </label>
                  ))}
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
