"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ApiError,
  desvincularLineaSolicitud,
  desvincularPedido,
  getProcurasParaCompra,
  getSolicitudesParaCompra,
  removeDetalle,
  updateDetalle,
  vincularLineaSolicitud,
  vincularPedido,
} from "../../lib/api";
import type { ProcuraCandidata, SolicitudLineaParaCompra, Proforma, ProformaDetalle, Proveedor, TipoProforma } from "../../lib/types";
import { Modal } from "../Modal";
import { formatAtributosVisibles } from "./AtributosVisibles";
import { ProveedorSelector } from "./selectors";
import { mlPorPresentacion, porUnidadLinea, unidadesLinea } from "../../lib/linea-venta";

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

function formatFechaNota(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

/** Liga/suelta los faltantes (Procura) de notas de venta aprobadas que esta línea de compra viene a
 * cubrir. Aplica a cualquier línea de compra: lo que no se liga queda como stock. */
function LigarNotasModal({ detalle, onClose, onChanged }: { detalle: ProformaDetalle; onClose: () => void; onChanged: () => void }) {
  const [procuras, setProcuras] = useState<ProcuraCandidata[] | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudLineaParaCompra[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  // Cantidad elegida por faltante (por defecto, lo máximo que cabe).
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  function load() {
    getProcurasParaCompra(detalle.id)
      .then(setProcuras)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    getSolicitudesParaCompra(detalle.id)
      .then(setSolicitudes)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }
  useEffect(load, [detalle.id]);

  async function toggle(p: ProcuraCandidata, maximo: number) {
    setBusyId(p.id);
    setError("");
    try {
      if (p.compraDetalleId === detalle.id) await desvincularPedido(p.id);
      else await vincularPedido(p.id, detalle.id, Math.min(cantidades[p.id] ?? maximo, maximo));
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSolicitud(s: SolicitudLineaParaCompra, maximo: number) {
    setBusyId(s.id);
    setError("");
    try {
      if (s.compraDetalleId === detalle.id) await desvincularLineaSolicitud(s.id);
      else await vincularLineaSolicitud(s.id, detalle.id, Math.min(cantidades[s.id] ?? maximo, maximo));
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const cubiertoVentas = (procuras ?? []).filter((p) => p.compraDetalleId === detalle.id).reduce((s, p) => s + p.cantidad, 0);
  const cubiertoSolicitudes = (solicitudes ?? []).filter((s) => s.compraDetalleId === detalle.id).reduce((s, p) => s + p.cantidad, 0);
  const cubierto = cubiertoVentas + cubiertoSolicitudes;
  const libre = detalle.cantidad - cubierto;

  return (
    <Modal title="Ligar a ventas y solicitudes" onClose={onClose} maxWidth={720}>
      <p className="cell-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Esta línea compra {detalle.cantidad} de {detalle.variante.product.name}. Elegí qué faltantes de notas de venta aprobadas y qué
        solicitudes de stock viene a cubrir ({cubierto} de {detalle.cantidad} ligadas, {libre} libres). Podés ligar solo una parte: el
        resto queda disponible para otra compra. Lo que no ligues es stock.
      </p>
      {!procuras && !error && <p>Cargando...</p>}
      {procuras && procuras.length === 0 && <p className="cell-muted">No hay faltantes pendientes de este producto en notas de venta aprobadas.</p>}
      {procuras && procuras.length > 0 && <p className="filter-label" style={{ margin: "4px 0" }}>Ventas con faltante</p>}
      {procuras && procuras.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {procuras.map((p) => {
            const ligada = p.compraDetalleId === detalle.id;
            const maximo = Math.min(p.cantidad, libre);
            const elegida = Math.min(cantidades[p.id] ?? maximo, maximo);
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {p.proformaDetalle.proforma.codigo} · {formatFechaNota(p.proformaDetalle.proforma.fecha)} · {p.proformaDetalle.proforma.cliente?.nombre ?? "—"} ·{" "}
                  {ligada ? `${p.cantidad} ligadas a esta línea` : `faltan ${p.cantidad}`}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {!ligada && maximo > 0 && (
                    <input
                      className="field"
                      type="number"
                      min={1}
                      max={maximo}
                      value={elegida}
                      aria-label="Cantidad a ligar"
                      onChange={(e) => setCantidades((prev) => ({ ...prev, [p.id]: Math.max(1, Math.min(maximo, parseInt(e.target.value, 10) || 1)) }))}
                      style={{ width: 64, textAlign: "center" }}
                    />
                  )}
                  <button
                    type="button"
                    className={`action-btn${ligada ? " danger" : ""}`}
                    disabled={busyId !== null || (!ligada && maximo <= 0)}
                    onClick={() => toggle(p, maximo)}
                  >
                    {ligada ? "Soltar" : maximo <= 0 ? "Sin cupo" : elegida < p.cantidad ? `Ligar ${elegida}` : "Ligar"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {solicitudes && solicitudes.length > 0 && (
        <>
          <p className="filter-label" style={{ margin: "16px 0 4px" }}>Solicitudes de stock</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {solicitudes.map((s) => {
              const ligada = s.compraDetalleId === detalle.id;
              const maximo = Math.min(s.cantidad, libre);
              const elegida = Math.min(cantidades[s.id] ?? maximo, maximo);
              return (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {s.solicitud.codigo} · {s.solicitud.creadoPor.nombre} · {ligada ? `${s.cantidad} ligadas a esta línea` : `piden ${s.cantidad}`}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {!ligada && maximo > 0 && (
                      <input
                        className="field"
                        type="number"
                        min={1}
                        max={maximo}
                        value={elegida}
                        aria-label="Cantidad a ligar"
                        onChange={(e) => setCantidades((prev) => ({ ...prev, [s.id]: Math.max(1, Math.min(maximo, parseInt(e.target.value, 10) || 1)) }))}
                        style={{ width: 64, textAlign: "center" }}
                      />
                    )}
                    <button
                      type="button"
                      className={`action-btn${ligada ? " danger" : ""}`}
                      disabled={busyId !== null || (!ligada && maximo <= 0)}
                      onClick={() => toggleSolicitud(s, maximo)}
                    >
                      {ligada ? "Soltar" : maximo <= 0 ? "Sin cupo" : elegida < s.cantidad ? `Ligar ${elegida}` : "Ligar"}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </>
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
  mostrarProveedor,
  puedeLigar,
  mostrarRecogido,
}: {
  proformaId: string;
  detalle: ProformaDetalle;
  tipo: TipoProforma;
  editable: boolean;
  tipoCambioProf: string | null;
  proveedores: Proveedor[];
  /** Solo compras viejas que mezclaban proveedores: el proveedor se elige por línea. */
  mostrarProveedor: boolean;
  /** La compra todavía admite cambios de vínculos con ventas (borrador o aprobada). */
  puedeLigar: boolean;
  /** Compra aprobada o completada: se muestra cuánto de la línea ya se recogió. */
  mostrarRecogido: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const [ligando, setLigando] = useState(false);
  const colSpan = (tipo === "VENTA" ? 7 : (mostrarProveedor ? 13 : 12) + (mostrarRecogido ? 1 : 0)) + (editable ? 1 : 0);
  const recogidas = (detalle.recojoLineas ?? []).reduce((n, r) => n + r.cantidad, 0);
  const ligadas = (detalle.asignacionesCubiertas ?? []).reduce((n, a) => n + a.cantidad, 0);
  const solicitadas = (detalle.solicitudesCubiertas ?? []).reduce((n, a) => n + a.cantidad, 0);

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
  // Decants (solo venta): la línea guarda ml y precio por ml, pero se ve y se edita por presentación.
  const factor = tipo === "VENTA" ? mlPorPresentacion(detalle) : 1;
  const cantidadVista = tipo === "VENTA" ? unidadesLinea(detalle) : detalle.cantidad;

  return (
    <>
      <tr>
        <td className="cell-code">{detalle.variante.product.productCode}</td>
        <td className="cell-muted">{detalle.variante.product.brand?.name ?? "—"}</td>
        <td className="cell-primary">
          {detalle.variante.product.name}
          {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
        </td>
        {tipo === "COMPRA" && mostrarProveedor && (
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
            <span className={ligadas + solicitadas > 0 ? undefined : "cell-muted"}>
              {ligadas + solicitadas > 0
                ? [ligadas > 0 ? `${ligadas} a ventas` : null, solicitadas > 0 ? `${solicitadas} a solicitudes` : null].filter(Boolean).join(" · ")
                : "Sin ligar (stock)"}
            </span>
            {puedeLigar && (
              <button type="button" className="link-button" style={{ display: "block", fontSize: 12 }} onClick={() => setLigando(true)}>
                Ligar a notas
              </button>
            )}
          </td>
        )}
        <td className="num">
          {editable ? (
            <EditableNumber value={cantidadVista} min={1} step="1" onCommit={(v) => commit({ cantidad: Math.round(v) * factor })} />
          ) : (
            cantidadVista
          )}
        </td>
        {tipo === "COMPRA" && mostrarRecogido && (
          <td className="num">
            {recogidas >= detalle.cantidad ? <span className="badge badge-success">{recogidas}</span> : <span className={recogidas > 0 ? "badge badge-warn" : "cell-muted"}>{recogidas} / {detalle.cantidad}</span>}
          </td>
        )}
        {tipo === "VENTA" ? (
          <>
            <td className="num">
              {editable ? (
                <EditableNumber value={porUnidadLinea(detalle, detalle.precioUnitario)} onCommit={(v) => commit({ precioUnitario: v / factor })} />
              ) : (
                money(String(porUnidadLinea(detalle, detalle.precioUnitario)), "Bs")
              )}
            </td>
            <td className="num">
              {editable ? (
                <EditableNumber value={porUnidadLinea(detalle, detalle.descuentoUnitario)} onCommit={(v) => commit({ descuentoUnitario: v / factor })} />
              ) : (
                money(String(porUnidadLinea(detalle, detalle.descuentoUnitario)), "Bs")
              )}
            </td>
          </>
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
      {/* Portal: el modal no puede ser hijo de <tbody> (HTML inválido → error de hidratación). */}
      {ligando &&
        createPortal(<LigarNotasModal detalle={detalle} onClose={() => setLigando(false)} onChanged={() => router.refresh()} />, document.body)}
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
  // Una nota de compra es de un proveedor; solo las viejas (sin proveedor de cabecera) lo llevan por línea.
  const mostrarProveedor = tipo === "COMPRA" && !proforma.proveedorId;
  const mostrarRecogido = tipo === "COMPRA" && (proforma.estado === "APROBADA" || proforma.estado === "COMPLETADA");

  if (detalles.length === 0) {
    return <p className="cell-muted">Todavía no hay líneas en esta proforma.</p>;
  }

  // Mismo cálculo de cantidad de columnas que usa DetalleRow para la fila de error — así la fila de
  // total de unidades, al final de la tabla, siempre calza sin importar tipo/editable.
  const colsEtiqueta = tipo === "COMPRA" ? 4 + (mostrarProveedor ? 1 : 0) : 3;
  const totalCols = (tipo === "VENTA" ? 7 : (mostrarProveedor ? 13 : 12) + (mostrarRecogido ? 1 : 0)) + (editable ? 1 : 0);
  // Un decant cuenta por presentación (1 decant de 5 ml = 1 unidad), no por ml.
  const totalCantidad = detalles.reduce((sum, d) => sum + (tipo === "VENTA" ? unidadesLinea(d) : d.cantidad), 0);

  return (
    <div className="table-scroll">
      <table className="table table-minimal table-compact">
        <thead>
          <tr>
            <th>ID Producto</th>
            <th>Marca</th>
            <th style={{ minWidth: 240 }}>Producto</th>
            {mostrarProveedor && <th>Proveedor</th>}
            {tipo === "COMPRA" && <th>Ligado a</th>}
            <th className="num">Cant.</th>
            {mostrarRecogido && <th className="num">Recogido</th>}
            {tipo === "VENTA" ? (
              <>
                <th className="num">Precio unitario</th>
                <th className="num">Desc. unitario</th>
              </>
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
              mostrarProveedor={mostrarProveedor}
              puedeLigar={proforma.estado === "BORRADOR" || proforma.estado === "APROBADA"}
              mostrarRecogido={mostrarRecogido}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={colsEtiqueta}
              className="cell-muted"
              style={{ textAlign: "right", fontWeight: 600, borderTop: "2px solid var(--line)" }}
            >
              Total unidades
            </td>
            <td className="num cell-primary" style={{ borderTop: "2px solid var(--line)" }}>
              {totalCantidad}
            </td>
            {totalCols > colsEtiqueta + 1 && (
              <td colSpan={totalCols - colsEtiqueta - 1} style={{ borderTop: "2px solid var(--line)" }}></td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
