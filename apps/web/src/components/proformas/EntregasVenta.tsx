"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, deshacerEntregaVenta, entregarVenta, getPagosProforma } from "../../lib/api";
import type { Cartera, CuentaPorCobrar, PagosVenta, Proforma, ProformaDetalle } from "../../lib/types";
import { Modal } from "../Modal";
import { CobroSaldoModal } from "./CobroSaldoModal";
import { LoteAsignacionTable } from "./LoteAsignacionTable";

function nombreDe(d: ProformaDetalle): string {
  return `${d.variante.product.name} (${d.variante.variantCode})`;
}

/** Lo reservado en stock físico de una línea: lo único que se puede entregar (lo que está en tránsito o falta no se toca). */
function listoPara(d: ProformaDetalle): number {
  return d.asignaciones.filter((a) => a.origen === "STOCK").reduce((n, a) => n + a.cantidad, 0);
}

function faltaLlegar(d: ProformaDetalle): number {
  return d.asignaciones.filter((a) => a.origen === "PROCURA" || a.origen === "EN_TRANSITO").reduce((n, a) => n + a.cantidad, 0);
}

function formatFecha(value: string): string {
  return new Date(value).toLocaleString("es-VE", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Entregas de una nota de venta aprobada: marcar productos como entregados saca del almacén lo reservado en stock físico
 * (consume lotes y baja el stock). Con todo entregado la nota se completa sola; una nota completada cuenta todo como
 * entregado. Las entregas se pueden deshacer mientras la nota siga aprobada.
 */
export function EntregasVenta({ proforma, carterasBs }: { proforma: Proforma; carterasBs: Cartera[] }) {
  const router = useRouter();
  const aprobada = proforma.estado === "APROBADA";
  const completada = proforma.estado === "COMPLETADA";
  const [modal, setModal] = useState<{ inicial: Record<string, number> } | null>(null);
  const [error, setError] = useState("");
  const [deshaciendo, setDeshaciendo] = useState<string | null>(null);

  const filas = proforma.detalles.map((d) => {
    const entregado = completada ? d.cantidad : (d.entregas ?? []).reduce((n, e) => n + e.cantidad, 0);
    return { d, entregado, listo: aprobada ? listoPara(d) : 0, falta: aprobada ? faltaLlegar(d) : 0 };
  });
  const totalListo = filas.reduce((n, f) => n + f.listo, 0);
  const entregas = proforma.detalles.flatMap((d) => (d.entregas ?? []).map((e) => ({ ...e, detalle: d }))).sort((a, b) => b.fecha.localeCompare(a.fecha));

  async function deshacer(entregaId: string) {
    if (!confirm("¿Deshacer esta entrega? Las unidades vuelven al stock reservado de esta nota.")) return;
    setDeshaciendo(entregaId);
    setError("");
    try {
      await deshacerEntregaVenta(proforma.id, entregaId);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setDeshaciendo(null);
    }
  }

  function abrirTodo() {
    setModal({ inicial: Object.fromEntries(filas.filter((f) => f.listo > 0).map((f) => [f.d.id, f.listo])) });
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 12px" }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Entregas</h2>
        {aprobada && totalListo > 0 && (
          <button type="button" className="action-btn" onClick={abrirTodo}>
            Entregar todo lo reservado
          </button>
        )}
      </div>

      <div className="table-scroll">
        <table className="table table-minimal table-compact">
          <thead>
            <tr>
              <th style={{ minWidth: 220 }}>Producto</th>
              <th className="num">Pedido</th>
              <th className="num">Entregado</th>
              <th className="num" title="Reservado en stock físico: se puede entregar ahora">Listo para entregar</th>
              <th className="num" title="Faltante o reservado en tránsito: todavía no se puede entregar">Falta llegar</th>
              {aprobada && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filas.map(({ d, entregado, listo, falta }) => (
              <tr key={d.id}>
                <td className="cell-primary">{nombreDe(d)}</td>
                <td className="num">{d.cantidad}</td>
                <td className="num">
                  {entregado >= d.cantidad ? (
                    <span className="badge badge-success">{entregado}</span>
                  ) : entregado > 0 ? (
                    <span className="badge badge-comprado">{entregado} / {d.cantidad}</span>
                  ) : (
                    <span className="cell-muted">—</span>
                  )}
                </td>
                <td className="num">{listo > 0 ? <strong>{listo}</strong> : <span className="cell-muted">—</span>}</td>
                <td className="num">{falta > 0 ? falta : <span className="cell-muted">—</span>}</td>
                {aprobada && (
                  <td className="num">
                    {listo > 0 && (
                      <button type="button" className="action-btn" onClick={() => setModal({ inicial: { [d.id]: listo } })}>
                        Entregar
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {completada && <p className="cell-muted" style={{ fontSize: 12, margin: "8px 0 0" }}>Nota completada: todo se considera entregado.</p>}
      {error && <p className="error-text">{error}</p>}

      {entregas.length > 0 && (
        <ul className="stock-panel-list" style={{ marginTop: 12 }}>
          {entregas.map((e) => (
            <li key={e.id}>
              <span>
                <strong>{e.cantidad}</strong> × {nombreDe(e.detalle)}
                <span className="cell-muted">
                  {" "}
                  · {formatFecha(e.fecha)} · {e.creadoPor.nombre}
                  {e.nota ? ` · ${e.nota}` : ""}
                </span>
              </span>
              {aprobada && (
                <button type="button" className="link-button" disabled={deshaciendo === e.id} onClick={() => deshacer(e.id)}>
                  {deshaciendo === e.id ? "Deshaciendo..." : "Deshacer"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {modal && <EntregarModal proforma={proforma} inicial={modal.inicial} carterasBs={carterasBs} onClose={() => setModal(null)} />}
    </>
  );
}

function EntregarModal({ proforma, inicial, carterasBs, onClose }: { proforma: Proforma; inicial: Record<string, number>; carterasBs: Cartera[]; onClose: () => void }) {
  const router = useRouter();
  const lineas = useMemo(() => proforma.detalles.filter((d) => listoPara(d) > 0), [proforma.detalles]);
  const [cantidades, setCantidades] = useState<Record<string, number>>(inicial);
  const [entradas, setEntradas] = useState<Record<string, { loteCompraId: string; cantidad: number }[]>>({});
  const [nota, setNota] = useState("");
  const [pagos, setPagos] = useState<PagosVenta | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cuenta, setCuenta] = useState<CuentaPorCobrar | null>(null);

  useEffect(() => {
    getPagosProforma(proforma.id).then(setPagos).catch(() => {});
  }, [proforma.id]);

  const elegidas = lineas.filter((d) => (cantidades[d.id] ?? 0) > 0);
  const cuadra = elegidas.length > 0 && elegidas.every((d) => (entradas[d.id] ?? []).reduce((n, e) => n + e.cantidad, 0) === cantidades[d.id]);

  async function confirmar() {
    if (!cuadra) return;
    setGuardando(true);
    setError("");
    try {
      const r = await entregarVenta(proforma.id, {
        lineas: elegidas.map((d) => ({ proformaDetalleId: d.id, lotes: entradas[d.id] ?? [] })),
        nota: nota.trim() || undefined,
      });
      if (r.estado === "COMPLETADA" && r.cuentaPorCobrar?.estado === "PENDIENTE") {
        setCuenta(r.cuentaPorCobrar);
        setGuardando(false);
      } else {
        onClose();
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setGuardando(false);
    }
  }

  if (cuenta) {
    return (
      <CobroSaldoModal
        cuenta={cuenta}
        carterasBs={carterasBs}
        onDone={() => {
          onClose();
          router.refresh();
        }}
      />
    );
  }

  return (
    <Modal title={`Entregar productos — ${proforma.codigo}`} onClose={onClose} maxWidth={820}>
      <p className="cell-muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
        Solo se entrega lo reservado en stock físico de <strong>{proforma.almacen?.nombre}</strong>. Elegí cuántas unidades de cada producto salen
        y de qué lotes (viene en orden FIFO, podés ajustarlo). Con todo entregado la nota se completa sola.
      </p>
      {pagos && pagos.saldo > 0 && (
        <p className="badge badge-warn" style={{ display: "block", whiteSpace: "normal", marginBottom: 12 }}>
          Atención: la nota tiene un saldo pendiente de cobro de Bs {pagos.saldo.toFixed(2)}.
        </p>
      )}

      <table className="table table-minimal table-compact" style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th>Producto</th>
            <th className="num">Reservado</th>
            <th className="num">Entregar</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((d) => {
            const max = listoPara(d);
            return (
              <tr key={d.id}>
                <td className="cell-primary">{nombreDe(d)}</td>
                <td className="num">{max}</td>
                <td className="num">
                  <span className="qty-stepper">
                    <input
                      type="number"
                      min={0}
                      max={max}
                      value={cantidades[d.id] ?? 0}
                      aria-label={`Unidades a entregar de ${d.variante.product.name}`}
                      onChange={(e) => setCantidades((p) => ({ ...p, [d.id]: Math.max(0, Math.min(max, parseInt(e.target.value, 10) || 0)) }))}
                    />
                  </span>
                  <button type="button" className="link-button" style={{ fontSize: 12, marginLeft: 6 }} onClick={() => setCantidades((p) => ({ ...p, [d.id]: max }))}>
                    Todo
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {proforma.almacenId &&
        elegidas.map((d) => (
          <LoteAsignacionTable
            key={`${d.id}-${cantidades[d.id]}`}
            varianteId={d.varianteId}
            almacenId={proforma.almacenId!}
            cantidadRequerida={cantidades[d.id]}
            nombreProducto={nombreDe(d)}
            onChange={(e) => setEntradas((p) => ({ ...p, [d.id]: e }))}
          />
        ))}

      <div className="filter-field" style={{ marginBottom: 12 }}>
        <label className="filter-label">Nota (opcional)</label>
        <input className="field" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder="Ej. retira el cliente" />
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="form-actions">
        <button type="button" className="link-button" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="button" onClick={confirmar} disabled={guardando || !cuadra}>
          {guardando ? "Guardando..." : "Marcar entregado"}
        </button>
      </div>
    </Modal>
  );
}
