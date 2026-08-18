"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, updateSeguimientoEstado } from "../../lib/api";
import type { EstadoSeguimientoProcura, SeguimientoLinea } from "../../lib/types";
import { Modal } from "../Modal";
import { formatAtributosVisibles } from "./AtributosVisibles";
import { CLASES_SEGUIMIENTO, LABELS_SEGUIMIENTO, ORDEN_SEGUIMIENTO } from "./seguimiento-estados";

function formatFecha(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

/** Qué distingue a esta variante puntual + los atributos heredados de la categoría marcados para
 * mostrarse en proforma — mismo criterio que ProformaDetalleTable, para que se vea igual acá. */
function atributosLabel(variante: SeguimientoLinea["proformaDetalle"]["variante"]): string | null {
  const opciones = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(variante.product.attributeValues, variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

/** Modal que pide la cantidad a mover al nuevo estado — el seguimiento de una línea puede avanzar de
 * a poco (ej. el proveedor despacha 20 de 50 pedidas), así que no siempre es "todo o nada". */
function CambiarEstadoModal({
  linea,
  siguienteEstado,
  onClose,
  onSaved,
}: {
  linea: SeguimientoLinea;
  siguienteEstado: EstadoSeguimientoProcura;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cantidad, setCantidad] = useState(String(linea.cantidad));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirmar() {
    const parsed = Number(cantidad);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > linea.cantidad) {
      setError(`Ingresá una cantidad entre 1 y ${linea.cantidad}.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateSeguimientoEstado(linea.id, siguienteEstado, parsed);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Marcar como ${LABELS_SEGUIMIENTO[siguienteEstado]}`} onClose={onClose}>
      <div className="form-grid">
        <p className="cell-muted" style={{ margin: 0 }}>
          {linea.proformaDetalle.variante.product.name} — pendiente: {linea.cantidad}
        </p>
        <div>
          <label>Cantidad</label>
          <input
            className="field"
            type="number"
            min={1}
            max={linea.cantidad}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
          <p className="cell-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
            Si es menor a la cantidad pendiente, el resto queda como está.
          </p>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <button type="button" className="link-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="button" disabled={saving} onClick={handleConfirmar}>
            {saving ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Fila({ linea, onPedirCantidad }: { linea: SeguimientoLinea; onPedirCantidad: (linea: SeguimientoLinea, siguienteEstado: EstadoSeguimientoProcura) => void }) {
  const { proforma, variante } = linea.proformaDetalle;
  const etiqueta = atributosLabel(variante);

  const indiceActual = ORDEN_SEGUIMIENTO.indexOf(linea.estadoSeguimiento);
  const siguienteEstado = ORDEN_SEGUIMIENTO[indiceActual + 1];

  return (
    <tr>
      <td className="cell-muted">{formatFecha(proforma.fecha)}</td>
      <td className="cell-muted">{variante.product.brand?.name ?? "—"}</td>
      <td className="cell-primary">
        {variante.product.name}
        {etiqueta && (
          <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>
            {etiqueta}
          </div>
        )}
      </td>
      <td className="num">{linea.cantidad}</td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={CLASES_SEGUIMIENTO[linea.estadoSeguimiento]}>{LABELS_SEGUIMIENTO[linea.estadoSeguimiento]}</span>
          {siguienteEstado && (
            <button type="button" className="action-btn" onClick={() => onPedirCantidad(linea, siguienteEstado)}>
              Marcar {LABELS_SEGUIMIENTO[siguienteEstado]}
            </button>
          )}
        </div>
      </td>
      <td>
        <Link href={`/dashboard/proformas/${proforma.id}`} className="link-button">
          Ver proforma
        </Link>
      </td>
    </tr>
  );
}

/**
 * Todo lo que hoy está a Procura (venta aprobada sin stock suficiente todavía), de cualquier proforma
 * — la vista operativa de "qué falta pedirle al proveedor". Se recalcula en vivo: cambia solo cuando
 * una compra resuelve la Procura o se anula la venta que la generaba.
 */
export function SeguimientoPendienteTable({ lineas }: { lineas: SeguimientoLinea[] }) {
  const router = useRouter();
  const [pendiente, setPendiente] = useState<{ linea: SeguimientoLinea; siguienteEstado: EstadoSeguimientoProcura } | null>(null);

  if (lineas.length === 0) {
    return <p className="cell-muted">No hay productos a Procura para estos filtros.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="table table-minimal">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Marca</th>
            <th>Producto</th>
            <th className="num">Cant.</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((linea) => (
            <Fila key={linea.id} linea={linea} onPedirCantidad={(l, e) => setPendiente({ linea: l, siguienteEstado: e })} />
          ))}
        </tbody>
      </table>
      {pendiente && (
        <CambiarEstadoModal
          linea={pendiente.linea}
          siguienteEstado={pendiente.siguienteEstado}
          onClose={() => setPendiente(null)}
          onSaved={() => {
            setPendiente(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
