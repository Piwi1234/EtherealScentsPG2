"use client";

import { useState } from "react";
import { ApiError, cobrarCuenta } from "../../lib/api";
import type { Cartera, CuentaPorCobrar } from "../../lib/types";
import { Modal } from "../Modal";
import { CarteraSelector } from "./selectors";

/** Cobro del saldo pendiente de una nota recién completada: es un paso aparte del completar (otra llamada al backend) que
 * usa el mismo endpoint que el gestor de Cuentas por Cobrar. Con monto 0 o "Omitir" la cuenta queda PENDIENTE y se cobra
 * después desde ese gestor. */
export function CobroSaldoModal({ cuenta, carterasBs, onDone }: { cuenta: CuentaPorCobrar; carterasBs: Cartera[]; onDone: () => void }) {
  const [montoInput, setMontoInput] = useState(cuenta.montoAdeudado);
  const [carteraId, setCarteraId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function confirmar() {
    const monto = Number(montoInput);
    if (Number.isNaN(monto) || monto < 0 || monto > Number(cuenta.montoAdeudado)) {
      setError(`Ingresá un monto entre 0 y Bs ${cuenta.montoAdeudado}.`);
      return;
    }
    if (monto === 0) {
      onDone();
      return;
    }
    if (!carteraId) {
      setError("Elegí la cartera en Bs donde se registra el cobro.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await cobrarCuenta(cuenta.id, { monto, carteraId });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Registrar cobro" onClose={onDone}>
      <p>
        Quedó un saldo pendiente de <strong>Bs {cuenta.montoAdeudado}</strong>. Ingresá cuánto se cancela ahora — podés dejarlo en 0 y
        cobrarlo después desde Cuentas por Cobrar.
      </p>
      <div className="filter-field" style={{ marginBottom: 12 }}>
        <label className="filter-label">Monto a cancelar (Bs)</label>
        <input className="field" type="number" min={0} max={Number(cuenta.montoAdeudado)} step="0.01" value={montoInput} onChange={(e) => setMontoInput(e.target.value)} />
      </div>
      {Number(montoInput) > 0 && (
        <div className="filter-field" style={{ marginBottom: 12 }}>
          <label className="filter-label">Cartera (Bs)</label>
          <CarteraSelector options={carterasBs} value={carteraId} onChange={setCarteraId} />
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      <div className="form-actions">
        <button type="button" className="link-button" onClick={onDone}>
          Omitir
        </button>
        <button type="button" className="button" onClick={confirmar} disabled={submitting}>
          {submitting ? "Guardando..." : "Confirmar"}
        </button>
      </div>
    </Modal>
  );
}
