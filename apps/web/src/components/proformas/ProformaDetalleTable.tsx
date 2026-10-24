"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, desvincularPedido, getProcurasParaCompra, removeDetalle, updateDetalle, vincularPedido } from "../../lib/api";
import type { DestinoCompra, ProcuraCandidata, Proforma, ProformaDetalle, Proveedor, TipoProforma } from "../../lib/types";
import { Modal } from "../Modal";
import { formatAtributosVisibles } from "./AtributosVisibles";
import { ProveedorSelector } from "./selectors";

/** Qué distingue a esta variante puntual (ej. "Tamaño: 50 ML") + los atributos heredados de la
 * categoría marcados para mostrarse en proforma +, si es una venta fraccionada (unidad=ML), qué
 * presentación se vendió (ej. "Presentación: 10 ml") — todo concatenado en una sola línea bajo el nombre. */
function atributosLabel(detalle: ProformaDetalle): string | null {
  const opciones = detalle.variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(detalle.variante.product.attributeValues, detalle.variante.product.variantOptionValues);
  const presentacion = detalle.presentacionVenta ? `Presentación: ${detalle.presentacionVenta.cantidadMl} ml` : null;
  const partes = [...opciones, ...(heredados ? [heredados] : []), ...(presentacion ? [presentacion] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

function money(value: string | null, prefix: string): string {
  return `${prefix} ${Number(value ?? 0).toFixed(2)}`;
}

function EditableNumber({
  value,
  min = 0,
  step,
  onCommit,
}: {
  value: number | string | null;
  min?: number;
  step?: string;
  onCommit: (value: number) => void;
}) {
  return (
    <input
      className="field"
      type="number"
      min={min}
      step={step ?? "0.01"}
      defaultValue={value ?? 0}
      onBlur={(e) => {
        const parsed = Number(e.target.value);
        if (!Number.isNaN(parsed)) onCommit(parsed);
      }}
      style={{ width: 70, textAlign: "center" }}
    />
  );
}

/** Liga/suelta los faltantes (Procura) de notas de venta aprobadas que esta línea de compra viene a
 * cubrir. Solo aplica a líneas con destino "Pedido de cliente". */
function LigarNotasModal({ detalle, onClose, onChanged }: { detalle: ProformaDetalle; onClose: () => void; onChanged: () => void }) {
  const [procuras, setProcuras] = useState<ProcuraCandidata[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    getProcurasParaCompra(detalle.id)
      .then(setProcuras)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }
  useEffect(load, [detalle.id]);

  async function toggle(p: ProcuraCandidata) {
    setBusyId(p.id);
    setError("");
    try {
      if (p.compraDetalleId === detalle.id) await desvincularPedido(p.id);
      else await vincularPedido(p.id, detalle.id);
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const cubierto = (procuras ?? []).filter((p) => p.compraDetalleId === detalle.id).reduce((s, p) => s + p.cantidad, 0);

  return (
    <Modal title="Ligar a notas de venta" onClose={onClose}>
      <p className="cell-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Esta línea compra {detalle.cantidad} de {detalle.variante.product.name}. Elegí qué faltantes de notas de venta aprobadas viene
        a cubrir ({cubierto} de {detalle.cantidad} ligadas).
      </p>
      {!procuras && !error && <p>Cargando...</p>}
      {procuras && procuras.length === 0 && <p className="cell-muted">No hay faltantes pendientes de este producto en notas de venta aprobadas.</p>}
      {procuras && procuras.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {procuras.map((p) => {
            const ligada = p.compraDetalleId === detalle.id;
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span>
                  {p.proformaDetalle.proforma.codigo} · {p.proformaDetalle.proforma.cliente?.nombre ?? "—"} · faltan {p.cantidad}
                </span>
                <button type="button" className={`action-btn${ligada ? " danger" : ""}`} disabled={busyId !== null} onClick={() => toggle(p)}>
                  {ligada ? "Soltar" : "Ligar"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
    </Modal>
  );
}

function DetalleRow({
  proformaId,
  detalle,
  tipo,
  editable,
  tipoCambioProf,
  proveedores,
}: {
  proformaId: string;
  detalle: ProformaDetalle;
  tipo: TipoProforma;
  editable: boolean;
  tipoCambioProf: string | null;
  proveedores: Proveedor[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const [ligando, setLigando] = useState(false);
  const colSpan = (tipo === "VENTA" ? 6 : 13) + (editable ? 1 : 0);

  async function commit(patch: Partial<import("../../lib/types").UpdateDetalleInput>) {
    setError("");
    try {
      await updateDetalle(proformaId, detalle.id, patch);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function handleRemove() {
    if (!confirm("¿Quitar esta línea de la proforma?")) return;
    setRemoving(true);
    setError("");
    try {
      await removeDetalle(proformaId, detalle.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setRemoving(false);
    }
  }

  const etiqueta = atributosLabel(detalle);

  return (
    <>
      <tr>
        <td className="cell-code">{detalle.variante.product.productCode}</td>
        <td className="cell-muted">{detalle.variante.product.brand?.name ?? "—"}</td>
        <td className="cell-primary">
          {detalle.variante.product.name}
          {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
        </td>
        {tipo === "COMPRA" && (
          <td style={{ minWidth: 160 }}>
            {editable ? (
              <ProveedorSelector
                options={proveedores}
                value={detalle.proveedorId ?? ""}
                // Vacío ("— Elegir proveedor —") no se manda: el backend valida proveedorId como
                // UUID cuando viene, un string vacío lo rechazaría — simplemente no hay forma de
                // "limpiarlo" una vez elegido, solo de cambiarlo por otro.
                onChange={(v) => v && commit({ proveedorId: v })}
              />
            ) : (
              detalle.proveedor?.nombre ?? "—"
            )}
            {editable && !detalle.proveedorId && (
              <p className="error-text" style={{ fontSize: 11, margin: "4px 0 0" }}>
                Sin proveedor
              </p>
            )}
          </td>
        )}
        {tipo === "COMPRA" && (
          <td style={{ minWidth: 150 }}>
            {editable ? (
              <select className="field" value={detalle.destino} onChange={(e) => commit({ destino: e.target.value as DestinoCompra })}>
                <option value="STOCK">Para stock</option>
                <option value="PEDIDO">Pedido de cliente</option>
              </select>
            ) : detalle.destino === "PEDIDO" ? (
              "Pedido de cliente"
            ) : (
              "Para stock"
            )}
            {detalle.destino === "PEDIDO" && (
              <button type="button" className="link-button" style={{ display: "block", fontSize: 12 }} onClick={() => setLigando(true)}>
                Ligar a notas
              </button>
            )}
          </td>
        )}
        <td className="num">
          {editable ? (
            <EditableNumber value={detalle.cantidad} min={1} step="1" onCommit={(v) => commit({ cantidad: v })} />
          ) : (
            detalle.cantidad
          )}
        </td>
        {tipo === "VENTA" ? (
          <td className="num">
            {editable ? (
              <EditableNumber value={detalle.precioUnitario} onCommit={(v) => commit({ precioUnitario: v })} />
            ) : (
              money(detalle.precioUnitario, "Bs")
            )}
          </td>
        ) : (
          <>
            <td className="num">
              {editable ? (
                <EditableNumber value={detalle.precioCompra} onCommit={(v) => commit({ precioCompra: v })} />
              ) : (
                money(detalle.precioCompra, "$")
              )}
            </td>
            <td className="num">
              {editable ? (
                <EditableNumber value={detalle.costoEnvio} onCommit={(v) => commit({ costoEnvio: v })} />
              ) : (
                money(detalle.costoEnvio, "$")
              )}
            </td>
            <td className="num">
              {editable ? (
                <EditableNumber value={detalle.costoSeguridad} onCommit={(v) => commit({ costoSeguridad: v })} />
              ) : (
                money(detalle.costoSeguridad, "$")
              )}
            </td>
            <td className="num">
              {editable ? (
                <EditableNumber value={detalle.costoLogistica} onCommit={(v) => commit({ costoLogistica: v })} />
              ) : (
                money(detalle.costoLogistica, "$")
              )}
            </td>
            <td className="num">
              {tipoCambioProf
                ? `Bs ${(
                    (Number(detalle.precioCompra) + Number(detalle.costoEnvio) + Number(detalle.costoSeguridad) + Number(detalle.costoLogistica)) *
                    Number(tipoCambioProf)
                  ).toFixed(2)}`
                : "—"}
            </td>
          </>
        )}
        <td className="num cell-primary">{money(detalle.subtotal, tipo === "VENTA" ? "Bs" : "$")}</td>
        {tipo === "COMPRA" && (
          <td className="num cell-primary">
            {tipoCambioProf ? `Bs ${(Number(detalle.subtotal) * Number(tipoCambioProf)).toFixed(2)}` : "—"}
          </td>
        )}
        {editable && (
          <td className="num">
            <button type="button" className="action-btn danger" onClick={handleRemove} disabled={removing}>
              Quitar
            </button>
          </td>
        )}
      </tr>
      {error && (
        <tr>
          <td colSpan={colSpan} className="error-text" style={{ borderBottom: "1px solid var(--line)" }}>
            {error}
          </td>
        </tr>
      )}
      {ligando && <LigarNotasModal detalle={detalle} onClose={() => setLigando(false)} onChanged={() => router.refresh()} />}
    </>
  );
}

/**
 * Tabla dual VENTA/COMPRA de líneas de una proforma. `editable` habilita inputs inline (cantidad +
 * precio en venta, cantidad + los 4 costos en compra) que guardan con onBlur — cada campo es su
 * propio PATCH, sin estado local de formulario. Se usa tanto en el constructor (BORRADOR) como en
 * modo solo-lectura (APROBADA/COMPLETADA/ANULADA), pasando `editable={false}`.
 */
export function ProformaDetalleTable({
  proforma,
  editable,
  proveedores = [],
}: {
  proforma: Proforma;
  editable: boolean;
  proveedores?: Proveedor[];
}) {
  const { tipo, detalles } = proforma;

  if (detalles.length === 0) {
    return <p className="cell-muted">Todavía no hay líneas en esta proforma.</p>;
  }

  // Mismo cálculo de cantidad de columnas que usa DetalleRow para la fila de error — así la fila de
  // total de unidades, al final de la tabla, siempre calza sin importar tipo/editable.
  const totalCols = (tipo === "VENTA" ? 6 : 13) + (editable ? 1 : 0);
  const totalCantidad = detalles.reduce((sum, d) => sum + d.cantidad, 0);

  return (
    <div className="table-scroll">
      <table className="table table-minimal">
        <thead>
          <tr>
            <th>ID Producto</th>
            <th>Marca</th>
            <th style={{ minWidth: 240 }}>Producto</th>
            {tipo === "COMPRA" && <th>Proveedor</th>}
            {tipo === "COMPRA" && <th>Destino</th>}
            <th className="num">Cant.</th>
            {tipo === "VENTA" ? (
              <th className="num">Precio unitario</th>
            ) : (
              <>
                <th className="num">Compra</th>
                <th className="num">Envío</th>
                <th className="num">Seguridad</th>
                <th className="num">Logística</th>
                <th className="num">Precio Unit Bs</th>
              </>
            )}
            <th className="num">Subtotal</th>
            {tipo === "COMPRA" && <th className="num">Subtotal Bs</th>}
            {editable && <th></th>}
          </tr>
        </thead>
        <tbody>
          {detalles.map((detalle) => (
            <DetalleRow
              key={`${detalle.id}-${detalle.updatedAt}`}
              proformaId={proforma.id}
              detalle={detalle}
              tipo={tipo}
              editable={editable}
              tipoCambioProf={proforma.tipoCambioProf}
              proveedores={proveedores}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={tipo === "COMPRA" ? 5 : 3}
              className="cell-muted"
              style={{ textAlign: "right", fontWeight: 600, borderTop: "2px solid var(--line)" }}
            >
              Total unidades
            </td>
            <td className="num cell-primary" style={{ borderTop: "2px solid var(--line)" }}>
              {totalCantidad}
            </td>
            {totalCols > (tipo === "COMPRA" ? 6 : 4) && (
              <td colSpan={totalCols - (tipo === "COMPRA" ? 6 : 4)} style={{ borderTop: "2px solid var(--line)" }}></td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
