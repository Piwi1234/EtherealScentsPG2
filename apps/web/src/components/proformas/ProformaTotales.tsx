"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, updateProforma } from "../../lib/api";
import type { Proforma } from "../../lib/types";

function money(value: number, prefix: string): string {
  return `${prefix} ${value.toFixed(2)}`;
}

function Row({
  label,
  children,
  strong,
  border,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
  border?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        marginBottom: 8,
        paddingTop: border ? 8 : 0,
        borderTop: border ? "1px solid var(--line)" : undefined,
        fontWeight: strong ? 600 : undefined,
      }}
    >
      <span className={strong ? undefined : "cell-muted"}>{label}</span>
      {children}
    </div>
  );
}

/**
 * Resumen de totales, junto al monto que generan las líneas — el descuento general y el adelanto
 * viven acá (no en la cabecera) porque solo tienen sentido en relación al total ya calculado.
 * Igual que la cabecera, el backend solo acepta el PATCH mientras la proforma está en BORRADOR.
 * El adelanto se define como % del total; el monto a pagar y el saldo se calculan en vivo acá, no
 * se guardan (si el total cambia porque se agrega/edita una línea, quedan siempre al día).
 * Ninguno de los dos aplica a COMPRA (el backend los rechaza para ese tipo) — ahí solo se muestra
 * el subtotal de las líneas.
 */
export function ProformaTotales({ proforma, editable }: { proforma: Proforma; editable: boolean }) {
  const router = useRouter();
  const prefix = proforma.tipo === "VENTA" ? "Bs" : "$";
  const subtotal = proforma.detalles.reduce((sum, d) => sum + Number(d.subtotal), 0);
  const esVenta = proforma.tipo === "VENTA";

  const [descuentoGeneral, setDescuentoGeneral] = useState(proforma.descuentoGeneral);
  const [adelantoPorcentaje, setAdelantoPorcentaje] = useState(proforma.adelantoPorcentaje ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const total = esVenta ? subtotal - (Number(descuentoGeneral) || 0) : subtotal;
  const porcentaje = esVenta ? Number(adelantoPorcentaje) || 0 : 0;
  const montoAdelanto = total * (porcentaje / 100);
  const saldo = total - montoAdelanto;

  async function commit(field: "descuentoGeneral" | "adelantoPorcentaje", raw: string) {
    const value = Number(raw);
    if (Number.isNaN(value)) return;
    setError("");
    setSubmitting(true);
    try {
      await updateProforma(proforma.id, { [field]: value });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!esVenta) {
    return (
      <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "14px 16px", maxWidth: 340, marginLeft: "auto" }}>
        <Row label="Total" strong>
          <span>{money(subtotal, prefix)}</span>
        </Row>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "14px 16px", maxWidth: 340, marginLeft: "auto" }}>
      <Row label="Subtotal">
        <span>{money(subtotal, prefix)}</span>
      </Row>

      <Row label="Descuento general">
        {editable ? (
          <input
            className="field"
            type="number"
            min={0}
            step="0.01"
            defaultValue={descuentoGeneral}
            onChange={(e) => setDescuentoGeneral(e.target.value)}
            onBlur={(e) => commit("descuentoGeneral", e.target.value)}
            disabled={submitting}
            style={{ width: 100, textAlign: "right" }}
          />
        ) : (
          <span>{money(Number(descuentoGeneral), prefix)}</span>
        )}
      </Row>

      <Row label="Total" strong border>
        <span>{money(total, prefix)}</span>
      </Row>

      <Row label="Adelanto">
        {editable ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              className="field"
              type="number"
              min={0}
              max={100}
              step="1"
              defaultValue={adelantoPorcentaje}
              onChange={(e) => setAdelantoPorcentaje(e.target.value)}
              onBlur={(e) => commit("adelantoPorcentaje", e.target.value)}
              disabled={submitting}
              style={{ width: 70, textAlign: "right" }}
            />
            <span className="cell-muted">%</span>
          </span>
        ) : (
          <span>{proforma.adelantoPorcentaje ? `${Number(proforma.adelantoPorcentaje)}%` : "—"}</span>
        )}
      </Row>

      {porcentaje > 0 && (
        <>
          <Row label="Monto de adelanto">
            <span>{money(montoAdelanto, prefix)}</span>
          </Row>
          <Row label="Saldo" strong border>
            <span>{money(saldo, prefix)}</span>
          </Row>
        </>
      )}

      {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
