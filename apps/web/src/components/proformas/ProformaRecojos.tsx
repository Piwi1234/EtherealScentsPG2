"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, anularRecojo, crearRecojo, getRecojos } from "../../lib/api";
import type { Proforma, RecojosCompra } from "../../lib/types";
import { Modal } from "../Modal";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-VE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Recojos de una compra: cada retiro de mercadería del proveedor, con lo que se recogió de cada línea. Se
 * puede recoger por partes (si el proveedor no entrega todo): lo que falta queda "por recoger" y se completa
 * en otro recojo. Lo recogido hace avanzar a "Recogido" lo que cubre (ventas y solicitudes de stock).
 */
export function ProformaRecojos({ proforma }: { proforma: Proforma }) {
  const router = useRouter();
  const [datos, setDatos] = useState<RecojosCompra | null>(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState("");
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [formError, setFormError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [deshaciendo, setDeshaciendo] = useState<string | null>(null);

  const cargar = useCallback(() => {
    return getRecojos(proforma.id)
      .then(setDatos)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, [proforma.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombreDe = (detalleId: string) => proforma.detalles.find((d) => d.id === detalleId)?.variante.product.name ?? "Producto";
  const marcaDe = (detalleId: string) => proforma.detalles.find((d) => d.id === detalleId)?.variante.product.brand?.name ?? null;

  function abrirModal() {
    setFecha(hoyISO());
    setNota("");
    setCantidades({});
    setFormError("");
    setModalOpen(true);
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    const lineas = Object.entries(cantidades)
      .filter(([, c]) => c > 0)
      .map(([compraDetalleId, cantidad]) => ({ compraDetalleId, cantidad }));
    if (lineas.length === 0) {
      setFormError("Ingresá cuántas unidades recogiste de al menos una línea.");
      return;
    }
    setGuardando(true);
    setFormError("");
    try {
      setDatos(await crearRecojo(proforma.id, { fecha: new Date(`${fecha}T12:00:00`).toISOString(), nota: nota.trim() || undefined, lineas }));
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  }

  async function handleDeshacer(recojoId: string) {
    if (!confirm("¿Deshacer este recojo? Las unidades vuelven a quedar por recoger.")) return;
    setDeshaciendo(recojoId);
    setError("");
    try {
      setDatos(await anularRecojo(recojoId));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setDeshaciendo(null);
    }
  }

  if (!datos) return error ? <p className="error-text">{error}</p> : null;

  const totalComprado = datos.resumen.reduce((n, r) => n + r.cantidad, 0);
  const totalRecogido = datos.resumen.reduce((n, r) => n + r.recogido, 0);
  const pendiente = totalComprado - totalRecogido;
  const puedeRecoger = proforma.estado === "APROBADA" && pendiente > 0;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>Recojos</h3>
          <span className="cell-muted" style={{ fontSize: 12.5 }}>
            {totalRecogido} de {totalComprado} unidades recogidas{pendiente > 0 ? ` · faltan ${pendiente}` : " · todo recogido"}
          </span>
        </div>
        {puedeRecoger && (
          <button type="button" className="action-btn" onClick={abrirModal}>
            + Registrar recojo
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="table-scroll">
        <table className="table table-minimal table-compact">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="num">Comprado</th>
              <th className="num">Recogido</th>
              <th className="num">Por recoger</th>
            </tr>
          </thead>
          <tbody>
            {datos.resumen.map((r) => (
              <tr key={r.compraDetalleId}>
                <td className="cell-primary">
                  {nombreDe(r.compraDetalleId)}
                  {marcaDe(r.compraDetalleId) && <span className="cell-muted" style={{ fontWeight: 400 }}> · {marcaDe(r.compraDetalleId)}</span>}
                </td>
                <td className="num">{r.cantidad}</td>
                <td className="num">{r.recogido}</td>
                <td className="num">{r.porRecoger > 0 ? <span className="badge badge-warn">{r.porRecoger}</span> : <span className="cell-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {datos.recojos.length > 0 && (
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          {datos.recojos.map((rj) => (
            <div key={rj.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 14px", border: "1px solid var(--color-divider)", borderRadius: 10 }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 13 }}>{formatDateTime(rj.fecha)}</strong>
                <span className="cell-muted" style={{ fontSize: 12.5 }}> · {rj.creadoPor.nombre}{rj.nota ? ` · ${rj.nota}` : ""}</span>
                <div className="cell-muted" style={{ fontSize: 12.5 }}>
                  {rj.lineas.map((l) => `${l.compraDetalle.variante.product.name} × ${l.cantidad}`).join(" · ")}
                </div>
              </div>
              {proforma.estado === "APROBADA" && (
                <button type="button" className="action-btn danger" disabled={deshaciendo !== null} onClick={() => handleDeshacer(rj.id)}>
                  {deshaciendo === rj.id ? "Deshaciendo..." : "Deshacer"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title="Registrar recojo" onClose={() => setModalOpen(false)} maxWidth={620}>
          <form className="form-grid" onSubmit={handleGuardar}>
            <p className="cell-muted" style={{ margin: 0, fontSize: 13 }}>
              Indicá cuántas unidades recogiste de cada línea. Lo que no recojas hoy queda por recoger para otro recojo.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div>
                <label>Fecha</label>
                <input className="field" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} required />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label>Nota (opcional)</label>
                <input className="field" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder="Ej. el proveedor dejó el resto para la próxima semana" />
              </div>
            </div>
            <div className="table-scroll">
              <table className="table table-minimal table-compact">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Por recoger</th>
                    <th className="num">Recogí hoy</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.resumen
                    .filter((r) => r.porRecoger > 0)
                    .map((r) => (
                      <tr key={r.compraDetalleId}>
                        <td className="cell-primary">{nombreDe(r.compraDetalleId)}</td>
                        <td className="num">{r.porRecoger}</td>
                        <td className="num">
                          <input
                            className="field"
                            type="number"
                            min={0}
                            max={r.porRecoger}
                            value={cantidades[r.compraDetalleId] ?? 0}
                            aria-label={`Unidades recogidas de ${nombreDe(r.compraDetalleId)}`}
                            onChange={(e) =>
                              setCantidades((prev) => ({ ...prev, [r.compraDetalleId]: Math.max(0, Math.min(r.porRecoger, parseInt(e.target.value, 10) || 0)) }))
                            }
                            style={{ width: 80, textAlign: "center" }}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div>
              <button
                type="button"
                className="link-button"
                onClick={() => setCantidades(Object.fromEntries(datos.resumen.filter((r) => r.porRecoger > 0).map((r) => [r.compraDetalleId, r.porRecoger])))}
              >
                Recogí todo lo que falta
              </button>
            </div>
            {formError && <p className="error-text">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="button" disabled={guardando}>
                {guardando ? "Guardando..." : "Registrar recojo"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
