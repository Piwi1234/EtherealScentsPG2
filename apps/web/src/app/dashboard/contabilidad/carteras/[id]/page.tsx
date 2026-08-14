"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ApiError,
  createMovimiento,
  createTraspaso,
  getCartera,
  getCarteras,
  getMovimientos,
  getTiposMovimiento,
} from "../../../../../lib/api";
import type { Cartera, MonedaCartera, MovimientoCartera, NaturalezaMovimiento, Page, TipoMovimiento } from "../../../../../lib/types";
import { formatMonto, labelTipoCambioTraspaso, monedaPermiteTraspaso, requiereTipoCambioTraspaso } from "../../../../../lib/moneda";
import { DateRangeDropdown, type DateSelection } from "../../../../../components/DateRangeDropdown";
import { Modal } from "../../../../../components/Modal";

const PAGE_SIZE = 20;
const TODO_EL_TIEMPO: DateSelection = { label: "Todo el tiempo" };

const CUENTA_SLUG: Record<MonedaCartera, string> = {
  BS: "cuenta-bs",
  USDT: "cuenta-usdt",
  GS: "cuenta-gs",
  CLP: "cuenta-chile",
  USD: "cuenta-usa",
};

function formatFecha(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

export default function CarteraDetallePage() {
  const params = useParams<{ id: string }>();
  const carteraId = params.id;

  const [cartera, setCartera] = useState<Cartera | null>(null);
  const [error, setError] = useState("");

  const [dateSelection, setDateSelection] = useState<DateSelection>(TODO_EL_TIEMPO);
  const [pageNum, setPageNum] = useState(1);
  const [data, setData] = useState<Page<MovimientoCartera> | null>(null);
  const [loading, setLoading] = useState(true);

  const [tiposIngreso, setTiposIngreso] = useState<TipoMovimiento[]>([]);
  const [tiposGasto, setTiposGasto] = useState<TipoMovimiento[]>([]);

  const [todasCarteras, setTodasCarteras] = useState<Cartera[]>([]);

  const [movModalOpen, setMovModalOpen] = useState(false);
  const [movNaturaleza, setMovNaturaleza] = useState<NaturalezaMovimiento>("INGRESO");
  const [movTipoId, setMovTipoId] = useState("");
  const [movDetalle, setMovDetalle] = useState("");
  const [movMonto, setMovMonto] = useState("");
  const [movError, setMovError] = useState("");
  const [movSubmitting, setMovSubmitting] = useState(false);

  const [traspasoModalOpen, setTraspasoModalOpen] = useState(false);
  const [traspasoDestinoId, setTraspasoDestinoId] = useState("");
  const [traspasoMonto, setTraspasoMonto] = useState("");
  const [traspasoTipoCambio, setTraspasoTipoCambio] = useState("");
  const [traspasoNota, setTraspasoNota] = useState("");
  const [traspasoError, setTraspasoError] = useState("");
  const [traspasoSubmitting, setTraspasoSubmitting] = useState(false);

  function loadCartera() {
    return getCartera(carteraId).then(setCartera);
  }

  function loadTipos() {
    Promise.all([
      getTiposMovimiento(carteraId, { naturaleza: "INGRESO" }),
      getTiposMovimiento(carteraId, { naturaleza: "GASTO" }),
    ]).then(([ingreso, gasto]) => {
      setTiposIngreso(ingreso);
      setTiposGasto(gasto);
    });
  }

  function loadMovimientos() {
    setLoading(true);
    return getMovimientos(carteraId, {
      fechaDesde: dateSelection.fechaDesde,
      fechaHasta: dateSelection.fechaHasta,
      page: pageNum,
      limit: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCartera().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    loadTipos();
    getCarteras({ activo: true }).then((all) => setTodasCarteras(all.filter((c) => c.id !== carteraId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carteraId]);

  useEffect(() => {
    loadMovimientos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carteraId, dateSelection, pageNum]);

  function handleDateApply(selection: DateSelection) {
    setDateSelection(selection);
    setPageNum(1);
  }

  function openMovModal(naturaleza: NaturalezaMovimiento) {
    setMovNaturaleza(naturaleza);
    setMovTipoId("");
    setMovDetalle("");
    setMovMonto("");
    setMovError("");
    setMovModalOpen(true);
  }

  async function handleSubmitMovimiento(e: React.FormEvent) {
    e.preventDefault();
    setMovError("");
    if (!movTipoId) {
      setMovError("Elegí un tipo.");
      return;
    }
    setMovSubmitting(true);
    try {
      await createMovimiento(carteraId, {
        detalle: movDetalle,
        naturaleza: movNaturaleza,
        monto: Number(movMonto),
        tipoMovimientoId: movTipoId,
      });
      setMovModalOpen(false);
      await Promise.all([loadCartera(), loadMovimientos()]);
    } catch (e) {
      setMovError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setMovSubmitting(false);
    }
  }

  const otrasCarteras = useMemo(
    () => (cartera ? todasCarteras.filter((c) => monedaPermiteTraspaso(cartera.moneda, c.moneda)) : []),
    [cartera, todasCarteras],
  );
  const destinoElegido = otrasCarteras.find((c) => c.id === traspasoDestinoId);
  const requiereTipoCambio = Boolean(cartera && destinoElegido && requiereTipoCambioTraspaso(cartera.moneda, destinoElegido.moneda));

  function openTraspasoModal() {
    setTraspasoDestinoId("");
    setTraspasoMonto("");
    setTraspasoTipoCambio("");
    setTraspasoNota("");
    setTraspasoError("");
    setTraspasoModalOpen(true);
  }

  async function handleSubmitTraspaso(e: React.FormEvent) {
    e.preventDefault();
    setTraspasoError("");
    if (!traspasoDestinoId) {
      setTraspasoError("Elegí una cartera destino.");
      return;
    }
    if (requiereTipoCambio && !traspasoTipoCambio) {
      setTraspasoError("Las monedas son distintas: el tipo de cambio es obligatorio.");
      return;
    }
    setTraspasoSubmitting(true);
    try {
      await createTraspaso({
        carteraOrigenId: carteraId,
        carteraDestinoId: traspasoDestinoId,
        montoOrigen: Number(traspasoMonto),
        tipoCambio: traspasoTipoCambio ? Number(traspasoTipoCambio) : undefined,
        nota: traspasoNota || undefined,
      });
      setTraspasoModalOpen(false);
      await Promise.all([loadCartera(), loadMovimientos()]);
    } catch (e) {
      setTraspasoError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setTraspasoSubmitting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const tiposDelModal = movNaturaleza === "INGRESO" ? tiposIngreso : tiposGasto;

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!cartera) {
    return (
      <div className="card">
        <p className="cell-muted">Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 20 }}>{cartera.nombre}</h1>
            <span className={`badge ${cartera.activo ? "badge-accent" : "badge-muted"}`}>
              {cartera.activo ? "Activa" : "Inactiva"}
            </span>
          </div>
          <Link href={`/dashboard/contabilidad/${CUENTA_SLUG[cartera.moneda]}`} className="link-button">
            Volver
          </Link>
        </div>
        <div className="grid-2">
          <div>
            <span className="filter-label">Saldo actual</span>
            <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700 }}>{formatMonto(cartera.saldoActual, cartera.moneda)}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" className="btn-cta" onClick={() => openMovModal("INGRESO")}>
            <span className="btn-cta-icon">+</span> Ingreso
          </button>
          <button type="button" className="btn-cta" onClick={() => openMovModal("GASTO")}>
            <span className="btn-cta-icon">+</span> Gasto
          </button>
          <button type="button" className="action-btn" onClick={openTraspasoModal}>
            Traspasar
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 16px", fontSize: 16 }}>Libro de caja</h2>
        <div className="filters-bar">
          <DateRangeDropdown onApply={handleDateApply} />
        </div>

        {loading ? (
          <p className="cell-muted">Cargando...</p>
        ) : !data || data.items.length === 0 ? (
          <p>No hay movimientos para estos filtros.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="table table-minimal">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Detalle</th>
                    <th>Tipo</th>
                    <th className="num">Ingreso</th>
                    <th className="num">Gasto</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((m) => (
                    <tr key={m.id}>
                      <td className="cell-muted">{formatFecha(m.fecha)}</td>
                      <td>{m.detalle}</td>
                      <td className="cell-muted">
                        {m.tipoMovimiento?.nombre ??
                          (m.traspaso
                            ? m.naturaleza === "GASTO"
                              ? `Traspaso a ${m.traspaso.carteraDestino.nombre}`
                              : `Traspaso desde ${m.traspaso.carteraOrigen.nombre}`
                            : "—")}
                      </td>
                      <td className="num">{m.naturaleza === "INGRESO" ? formatMonto(m.monto, cartera.moneda) : "—"}</td>
                      <td className="num">{m.naturaleza === "GASTO" ? formatMonto(m.monto, cartera.moneda) : "—"}</td>
                      <td className="num cell-primary">{formatMonto(m.total, cartera.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  className={`pagination-btn${pageNum <= 1 ? " disabled" : ""}`}
                  disabled={pageNum <= 1}
                  onClick={() => setPageNum((p) => p - 1)}
                >
                  ← Anterior
                </button>
                <span className="pagination-info">
                  Página {pageNum} de {totalPages}
                </span>
                <button
                  type="button"
                  className={`pagination-btn${pageNum >= totalPages ? " disabled" : ""}`}
                  disabled={pageNum >= totalPages}
                  onClick={() => setPageNum((p) => p + 1)}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {movModalOpen && (
        <Modal title={movNaturaleza === "INGRESO" ? "Nuevo ingreso" : "Nuevo gasto"} onClose={() => setMovModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmitMovimiento}>
            <div>
              <label>Tipo</label>
              <select className="field" value={movTipoId} onChange={(e) => setMovTipoId(e.target.value)} required>
                <option value="">— Elegir tipo —</option>
                {tiposDelModal.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
              {tiposDelModal.length === 0 && (
                <p className="cell-muted" style={{ fontSize: 13, marginTop: 4 }}>
                  No hay tipos todavía —{" "}
                  <Link href="/dashboard/contabilidad/tipos" className="link-button">
                    creá uno acá
                  </Link>
                  .
                </p>
              )}
            </div>
            <div>
              <label>Detalle</label>
              <input className="field" value={movDetalle} onChange={(e) => setMovDetalle(e.target.value)} required />
            </div>
            <div>
              <label>Monto</label>
              <input
                className="field"
                type="number"
                min="0.01"
                step="0.01"
                value={movMonto}
                onChange={(e) => setMovMonto(e.target.value)}
                required
              />
            </div>
            {movError && <p className="error-text">{movError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setMovModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="button" disabled={movSubmitting}>
                {movSubmitting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {traspasoModalOpen && (
        <Modal title="Traspasar" onClose={() => setTraspasoModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmitTraspaso}>
            <div>
              <label>Cartera destino</label>
              <select className="field" value={traspasoDestinoId} onChange={(e) => setTraspasoDestinoId(e.target.value)} required>
                <option value="">— Elegir cartera —</option>
                {otrasCarteras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Monto (en {cartera.moneda})</label>
              <input
                className="field"
                type="number"
                min="0.01"
                step="0.01"
                value={traspasoMonto}
                onChange={(e) => setTraspasoMonto(e.target.value)}
                required
              />
            </div>
            {requiereTipoCambio && destinoElegido && (
              <div>
                <label>Tipo de cambio ({labelTipoCambioTraspaso(cartera.moneda, destinoElegido.moneda)})</label>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={traspasoTipoCambio}
                  onChange={(e) => setTraspasoTipoCambio(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label>Nota (opcional)</label>
              <input className="field" value={traspasoNota} onChange={(e) => setTraspasoNota(e.target.value)} />
            </div>
            {traspasoError && <p className="error-text">{traspasoError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setTraspasoModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="button" disabled={traspasoSubmitting}>
                {traspasoSubmitting ? "Guardando..." : "Traspasar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
