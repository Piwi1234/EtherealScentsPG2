"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, desvincularPedido, getComprasCandidatas, vincularPedido } from "../../lib/api";
import { EnviosDeLinea } from "./EnviosDeLinea";
import { CrearComprasModal } from "./CrearComprasModal";
import type { CompraCandidata, SeguimientoLinea } from "../../lib/types";
import { Modal } from "../Modal";
import { formatAtributosVisibles } from "./AtributosVisibles";
import { CLASES_PEDIDO, LABELS_PEDIDO } from "./seguimiento-estados";

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

/** Elige a qué línea de compra (pedido de cliente, misma variante) se liga este faltante. */
function LigarCompraModal({ linea, onClose, onSaved }: { linea: SeguimientoLinea; onClose: () => void; onSaved: () => void }) {
  const [candidatas, setCandidatas] = useState<CompraCandidata[] | null>(null);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  useEffect(() => {
    getComprasCandidatas(linea.id)
      .then(setCandidatas)
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, [linea.id]);

  async function handleLigar(compraDetalleId: string, cantidad: number) {
    setSavingId(compraDetalleId);
    setError("");
    try {
      await vincularPedido(linea.id, compraDetalleId, cantidad);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setSavingId(null);
    }
  }

  return (
    <Modal title="Ligar a una compra" onClose={onClose} maxWidth={640}>
      <p className="cell-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Faltan <strong>{linea.cantidad}</strong> de {linea.proformaDetalle.variante.product.name} para la nota{" "}
        {linea.proformaDetalle.proforma.codigo}. Elegí la línea de compra (marcada como "Pedido de cliente") que los va a cubrir. Si la compra trae menos, podés ligar solo una parte y completar el resto con otra compra.
      </p>
      {!candidatas && !error && <p>Cargando...</p>}
      {candidatas && candidatas.length === 0 && (
        <p className="cell-muted">
          No hay compras con este producto. Agregalo en una compra (o usá "Crear compras" desde los faltantes) y volvé acá.
        </p>
      )}
      {candidatas && candidatas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {candidatas.map((c) => {
            const maximo = Math.min(c.restante, linea.cantidad);
            const elegida = Math.min(cantidades[c.id] ?? maximo, maximo);
            return (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span>
                  {c.proforma.codigo} · {c.proveedor?.nombre ?? "Sin proveedor"} · {c.restante} sin cubrir de {c.cantidad}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {maximo > 0 && (
                    <input
                      className="field"
                      type="number"
                      min={1}
                      max={maximo}
                      value={elegida}
                      aria-label="Cantidad a ligar"
                      onChange={(e) => setCantidades((prev) => ({ ...prev, [c.id]: Math.max(1, Math.min(maximo, parseInt(e.target.value, 10) || 1)) }))}
                      style={{ width: 64, textAlign: "center" }}
                    />
                  )}
                  <button type="button" className="action-btn" disabled={maximo <= 0 || savingId !== null} onClick={() => handleLigar(c.id, elegida)}>
                    {savingId === c.id ? "Ligando..." : maximo <= 0 ? "Sin cupo" : elegida < linea.cantidad ? `Ligar ${elegida}` : "Ligar"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
    </Modal>
  );
}

/**
 * Pedidos de clientes: los faltantes (Procura) de notas de venta aprobadas, con el estado derivado de la
 * compra y el envío que los cubren. No hay botones de "marcar comprado/enviado": el estado avanza solo a
 * medida que la compra se aprueba, entra a un envío y el envío sale.
 */
export function SeguimientoPendienteTable({ lineas }: { lineas: SeguimientoLinea[] }) {
  const router = useRouter();
  const [ligando, setLigando] = useState<SeguimientoLinea | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  // Faltantes elegidos para "Crear compras" (solo los que todavía no tienen compra).
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [creando, setCreando] = useState(false);

  const sinCompra = lineas.filter((l) => !l.compraDetalle);
  const todosElegidos = sinCompra.length > 0 && sinCompra.every((l) => seleccion.has(l.id));

  function alternar(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSoltar(linea: SeguimientoLinea) {
    setBusyId(linea.id);
    setError("");
    try {
      await desvincularPedido(linea.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (lineas.length === 0) {
    return <p className="cell-muted">No hay pedidos de clientes pendientes con estos filtros.</p>;
  }

  return (
    <>
      {error && <p className="error-text">{error}</p>}
      {sinCompra.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span className="cell-muted" style={{ fontSize: 12.5 }}>
            {seleccion.size > 0 ? `${seleccion.size} faltante${seleccion.size === 1 ? "" : "s"} elegido${seleccion.size === 1 ? "" : "s"}` : `${sinCompra.length} sin compra`}
          </span>
          <button type="button" className="btn-cta" disabled={seleccion.size === 0} onClick={() => setCreando(true)}>
            <span className="btn-cta-icon">+</span> Crear compras
          </button>
        </div>
      )}
      <div className="table-scroll">
        <table className="table table-minimal table-compact">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                {sinCompra.length > 0 && (
                  <input
                    type="checkbox"
                    aria-label="Elegir todos los faltantes sin compra"
                    checked={todosElegidos}
                    onChange={() => setSeleccion(todosElegidos ? new Set() : new Set(sinCompra.map((l) => l.id)))}
                  />
                )}
              </th>
              <th>Fecha</th>
              <th>Nota</th>
              <th>Cliente</th>
              <th>Marca</th>
              <th style={{ minWidth: 220 }}>Producto</th>
              <th className="num">Cant.</th>
              <th>Estado</th>
              <th>Compra / Envío</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((linea) => {
              const { proforma, variante } = linea.proformaDetalle;
              const etiqueta = atributosLabel(variante);
              const compra = linea.compraDetalle?.proforma;
              return (
                <tr key={linea.id}>
                  <td>
                    {!linea.compraDetalle && (
                      <input
                        type="checkbox"
                        aria-label={`Elegir ${variante.product.name} de ${proforma.codigo}`}
                        checked={seleccion.has(linea.id)}
                        onChange={() => alternar(linea.id)}
                      />
                    )}
                  </td>
                  <td className="cell-muted">{formatFecha(proforma.fecha)}</td>
                  <td>
                    <Link href={`/dashboard/proformas/${proforma.id}`} className="link-button">
                      {proforma.codigo}
                    </Link>
                  </td>
                  <td className="cell-muted">{proforma.cliente?.nombre ?? "—"}</td>
                  <td className="cell-muted">{variante.product.brand?.name ?? "—"}</td>
                  <td className="cell-primary">
                    {variante.product.name}
                    {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
                  </td>
                  <td className="num">{linea.cantidad}</td>
                  <td>
                    <span className={CLASES_PEDIDO[linea.estadoPedido]}>{LABELS_PEDIDO[linea.estadoPedido]}</span>
                    {(linea.estadoPedido === "COMPRADO" || linea.estadoPedido === "RECOGIDO") && (
                      <div className="cell-muted" style={{ fontSize: 12 }}>
                        {linea.recogidas ?? 0} de {linea.cantidad} recogidas
                      </div>
                    )}
                  </td>
                  <td className="cell-muted">
                    {compra && linea.estadoPedido !== "SIN_COMPRA" ? (
                      <>
                        <Link href={`/dashboard/proformas/${compra.id}`} className="link-button">
                          {compra.codigo}
                        </Link>
                        {linea.compraDetalle?.proveedor ? ` · ${linea.compraDetalle.proveedor.nombre}` : ""}
                        <EnviosDeLinea envioItems={linea.compraDetalle?.envioItems} />
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      {linea.compraDetalle && linea.estadoPedido !== "SIN_COMPRA" ? (
                        <button type="button" className="action-btn" disabled={busyId === linea.id} onClick={() => handleSoltar(linea)}>
                          Soltar
                        </button>
                      ) : (
                        <button type="button" className="action-btn" onClick={() => setLigando(linea)}>
                          Ligar a compra
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {creando && (
        <CrearComprasModal
          pedidos={lineas.filter((l) => seleccion.has(l.id))}
          solicitudes={[]}
          onClose={() => setCreando(false)}
          onCreated={() => {
            setCreando(false);
            setSeleccion(new Set());
            router.refresh();
          }}
        />
      )}
      {ligando && (
        <LigarCompraModal
          linea={ligando}
          onClose={() => setLigando(null)}
          onSaved={() => {
            setLigando(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
