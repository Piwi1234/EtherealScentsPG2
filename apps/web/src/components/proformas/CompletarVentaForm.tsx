"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, completarProforma } from "../../lib/api";
import type { Cartera, CuentaPorCobrar, Proforma } from "../../lib/types";
import { LoteAsignacionTable } from "./LoteAsignacionTable";
import { CobroSaldoModal } from "./CobroSaldoModal";

type Linea = { asignacionId: string; varianteId: string; cantidad: number; nombreProducto: string };

/** Reparto manual de lotes para completar una VENTA — una tabla por línea con asignación STOCK
 * (siempre contra `proforma.almacenId`, ya fijado al aprobar). No incluye líneas con Procura
 * pendiente: la página que renderiza este formulario ya bloqueó ese caso antes de llegar acá.
 *
 * Al completar, si queda saldo pendiente (backend crea la Cuenta por Cobrar), se ofrece cobrar ese
 * saldo ahora mismo — es un paso aparte (otra llamada al backend, no atómico con el completar) que
 * usa el mismo endpoint que el gestor de Cuentas por Cobrar. Si se omite, la cuenta queda PENDIENTE
 * y se puede cobrar después desde ese gestor. */
export function CompletarVentaForm({ proforma, carterasBs }: { proforma: Proforma; carterasBs: Cartera[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [entradasPorAsignacion, setEntradasPorAsignacion] = useState<Record<string, { loteCompraId: string; cantidad: number }[]>>(
    {},
  );

  const [cuenta, setCuenta] = useState<CuentaPorCobrar | null>(null);

  const lineas: Linea[] = proforma.detalles.flatMap((detalle) =>
    detalle.asignaciones
      .filter((a) => a.origen === "STOCK" && a.cantidad > 0)
      .map((a) => ({
        asignacionId: a.id,
        varianteId: detalle.varianteId,
        cantidad: a.cantidad,
        nombreProducto: `${detalle.variante.product.name} (${detalle.variante.variantCode})`,
      })),
  );

  const todasCuadran = useMemo(
    () =>
      lineas.every((linea) => {
        const suma = (entradasPorAsignacion[linea.asignacionId] ?? []).reduce((sum, e) => sum + e.cantidad, 0);
        return suma === linea.cantidad;
      }),
    [lineas, entradasPorAsignacion],
  );

  async function handleSubmit() {
    if (!proforma.almacenId || !todasCuadran) return;
    setSubmitting(true);
    setError("");
    try {
      const asignaciones = lineas.flatMap((linea) =>
        (entradasPorAsignacion[linea.asignacionId] ?? []).map((e) => ({
          proformaDetalleAsignacionId: linea.asignacionId,
          loteCompraId: e.loteCompraId,
          cantidad: e.cantidad,
        })),
      );
      const actualizada = await completarProforma(proforma.id, { asignaciones });
      if (actualizada.cuentaPorCobrar && actualizada.cuentaPorCobrar.estado === "PENDIENTE") {
        setCuenta(actualizada.cuentaPorCobrar);
        setSubmitting(false);
      } else {
        router.push(`/dashboard/proformas/${proforma.id}`);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setSubmitting(false);
    }
  }

  function irADetalle() {
    router.push(`/dashboard/proformas/${proforma.id}`);
  }

  if (!proforma.almacenId) {
    return <p className="error-text">Esta proforma no tiene almacén asignado.</p>;
  }
  if (lineas.length === 0) {
    return <p className="cell-muted">No hay líneas con stock reservado para completar.</p>;
  }

  return (
    <div>
      <p className="cell-muted" style={{ marginBottom: 20 }}>
        Almacén: <strong>{proforma.almacen?.nombre}</strong>. Repartí cada línea entre los lotes disponibles — ya viene
        precargado en orden FIFO (los lotes más antiguos primero), pero podés ajustarlo.
      </p>

      {lineas.map((linea) => (
        <LoteAsignacionTable
          key={linea.asignacionId}
          varianteId={linea.varianteId}
          almacenId={proforma.almacenId!}
          cantidadRequerida={linea.cantidad}
          nombreProducto={linea.nombreProducto}
          onChange={(entradas) => setEntradasPorAsignacion((prev) => ({ ...prev, [linea.asignacionId]: entradas }))}
        />
      ))}

      {error && <p className="error-text">{error}</p>}

      <div className="form-actions">
        <button type="button" className="link-button" onClick={() => router.push(`/dashboard/proformas/${proforma.id}`)}>
          Cancelar
        </button>
        <button type="button" className="button" onClick={handleSubmit} disabled={submitting || !todasCuadran}>
          {submitting ? "Completando..." : "Completar"}
        </button>
      </div>

      {cuenta && <CobroSaldoModal cuenta={cuenta} carterasBs={carterasBs} onDone={irADetalle} />}
    </div>
  );
}
