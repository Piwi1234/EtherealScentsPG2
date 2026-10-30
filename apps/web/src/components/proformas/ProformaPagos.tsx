"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, getPagosProforma, registrarPagoProforma } from "../../lib/api";
import type { Cartera, EstadoProforma, PagosVenta } from "../../lib/types";
import { Modal } from "../Modal";
import { CarteraSelector } from "./selectors";

function bs(value: number): string {
  return `Bs ${value.toFixed(2)}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Pagos de una venta: mientras está APROBADA el cliente puede pagar (adelanto o abonos) antes de que
 * se complete, y cada pago entra a la cartera en ese momento. Al completar, la Cuenta por Cobrar
 * nace solo con lo que todavía falta. Una vez completada, el saldo se cobra desde Cuentas por Cobrar:
 * acá queda el historial de lo cobrado hasta entonces.
 */
export function ProformaPagos({
  proformaId,
  estado,
  carterasBs,
  version,
}: {
  proformaId: string;
  estado: EstadoProforma;
  carterasBs: Cartera[];
  /** Cambia cuando la nota cambia por fuera de este panel (ajuste, entrega...): fuerza a volver a pedir total y saldo. */
  version?: string;
}) {
  const router = useRouter();
  const [pagos, setPagos] = useState<PagosVenta | null>(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [carteraId, setCarteraId] = useState("");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cargar = useCallback(() => {
    return getPagosProforma(proformaId)
      .then(setPagos)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, [proformaId]);

  // `version` hace que el resumen se vuelva a pedir cuando la nota cambia (ej. se ajustó y bajó el total): router.refresh()
  // no remonta este componente, y sin esto quedaría mostrando el total y el saldo de antes del ajuste.
  useEffect(() => {
    cargar();
  }, [cargar, version]);

  function abrirModal() {
    if (!pagos) return;
    // Sugiere lo que falta del adelanto; si ya está cubierto, el saldo completo.
    const sugerido = pagos.adelantoPendiente > 0 ? pagos.adelantoPendiente : pagos.saldo;
    setMonto(sugerido > 0 ? sugerido.toFixed(2) : "");
    setCarteraId("");
    setNota("");
    setFormError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const valor = Number(monto);
    if (!carteraId) return setFormError("Elegí la cartera en Bs donde entra el pago.");
    if (!valor || valor <= 0) return setFormError("Ingresá un monto mayor a cero.");
    setSubmitting(true);
    try {
      setPagos(await registrarPagoProforma(proformaId, { carteraId, monto: valor, nota: nota.trim() || undefined }));
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!pagos) return null;

  const puedeCobrar = estado === "APROBADA" && pagos.saldo > 0;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Pagos</h3>
        {puedeCobrar && (
          <button type="button" className="action-btn" onClick={abrirModal}>
            + Registrar pago
          </button>
        )}
      </div>

      <div className="pagos-resumen">
        <div>
          <span className="cell-muted">Total</span>
          <strong>{bs(pagos.total)}</strong>
        </div>
        <div>
          <span className="cell-muted">Pagado</span>
          <strong style={{ color: "var(--color-success, #2cc58a)" }}>{bs(pagos.pagado)}</strong>
        </div>
        <div>
          <span className="cell-muted">Saldo</span>
          <strong>{bs(pagos.saldo)}</strong>
        </div>
        {estado === "APROBADA" && pagos.adelantoPendiente > 0 && (
          <div>
            <span className="cell-muted">Adelanto pendiente</span>
            <strong>{bs(pagos.adelantoPendiente)}</strong>
          </div>
        )}
      </div>

      {pagos.movimientos.length === 0 ? (
        <p className="cell-muted">Todavía no se registró ningún pago.</p>
      ) : (
        <div className="table-scroll">
          <table className="table table-minimal table-compact">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Detalle</th>
                <th>Cartera</th>
                <th>Registró</th>
                <th className="num">Monto</th>
              </tr>
            </thead>
            <tbody>
              {pagos.movimientos.map((m) => (
                <tr key={m.id}>
                  <td className="cell-muted">{formatDateTime(m.fecha)}</td>
                  <td>{m.detalle}</td>
                  <td className="cell-muted">{m.cartera.nombre}</td>
                  <td className="cell-muted">{m.creadoPor.nombre}</td>
                  <td className="num cell-primary">
                    {m.naturaleza === "INGRESO" ? "+" : "−"} {bs(Number(m.monto))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal title="Registrar pago" onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <p className="cell-muted" style={{ margin: 0 }}>
              Saldo pendiente: <strong>{bs(pagos.saldo)}</strong>
              {pagos.adelantoPendiente > 0 && <> · adelanto pendiente: <strong>{bs(pagos.adelantoPendiente)}</strong></>}
            </p>
            <div>
              <label>Cartera (Bs)</label>
              <CarteraSelector options={carterasBs} value={carteraId} onChange={setCarteraId} />
            </div>
            <div>
              <label>Monto (Bs)</label>
              <input
                className="field"
                type="number"
                min="0.01"
                max={pagos.saldo}
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Nota (opcional)</label>
              <input className="field" value={nota} maxLength={120} onChange={(e) => setNota(e.target.value)} placeholder="Ej. adelanto, transferencia" />
            </div>
            {formError && <p className="error-text">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="button" disabled={submitting}>
                {submitting ? "Guardando..." : "Registrar pago"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
