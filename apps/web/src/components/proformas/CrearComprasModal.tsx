"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, crearComprasDesdeFaltantes, getPendientesPorVariante, getProveedores, getSugerenciasCompra } from "../../lib/api";
import type { CompraCreada, PendientesPorVariante, Proveedor, SeguimientoLinea, SolicitudLineaSeguimiento } from "../../lib/types";
import { Modal } from "../Modal";

type Fila = {
  varianteId: string;
  nombre: string;
  marca: string | null;
  pedidos: { id: string; cantidad: number }[];
  solicitudes: { id: string; cantidad: number }[];
};

const suma = (xs: { cantidad: number }[]) => xs.reduce((n, x) => n + x.cantidad, 0);

/**
 * Arma una nota de compra por proveedor desde lo elegido en Seguimiento: faltantes de ventas y/o líneas de
 * solicitudes de stock. Cada producto suma lo que piden las dos listas (también lo pendiente de la otra lista
 * que no elegiste, si quieres) más unidades extra para stock; el proveedor arranca con el último al que se le
 * compró ese producto. Las notas se crean en borrador y ya quedan ligadas.
 */
export function CrearComprasModal({
  pedidos,
  solicitudes,
  onClose,
  onCreated,
}: {
  pedidos: SeguimientoLinea[];
  solicitudes: SolicitudLineaSeguimiento[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorPor, setProveedorPor] = useState<Record<string, string>>({});
  const [extraPor, setExtraPor] = useState<Record<string, number>>({});
  const [otros, setOtros] = useState<PendientesPorVariante | null>(null);
  const [incluirVentas, setIncluirVentas] = useState<Record<string, boolean>>({});
  const [incluirSolicitudes, setIncluirSolicitudes] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [creadas, setCreadas] = useState<CompraCreada[] | null>(null);

  // Un renglón por producto con lo elegido de cada lista.
  const filas = useMemo(() => {
    const porVariante = new Map<string, Fila>();
    const get = (v: { id: string; product: { name: string; brand: { name: string } | null } }) => {
      const f = porVariante.get(v.id) ?? { varianteId: v.id, nombre: v.product.name, marca: v.product.brand?.name ?? null, pedidos: [], solicitudes: [] };
      porVariante.set(v.id, f);
      return f;
    };
    for (const l of pedidos) get(l.proformaDetalle.variante).pedidos.push({ id: l.id, cantidad: l.cantidad });
    for (const l of solicitudes) get(l.variante).solicitudes.push({ id: l.id, cantidad: l.cantidad });
    return Array.from(porVariante.values());
  }, [pedidos, solicitudes]);

  useEffect(() => {
    const ids = filas.map((f) => f.varianteId);
    getProveedores({ activo: "true", pageSize: 500 })
      .then((p) => setProveedores(p.items))
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    getSugerenciasCompra(ids)
      .then((sugeridos) => setProveedorPor((prev) => ({ ...sugeridos, ...prev })))
      .catch(() => {});
    getPendientesPorVariante(ids)
      .then(setOtros)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Lo pendiente de la otra lista (no elegido) para un producto. */
  function extrasDe(f: Fila) {
    const pedidosOtros = (otros?.pedidos ?? []).filter((p) => p.varianteId === f.varianteId && !f.pedidos.some((x) => x.id === p.id));
    const stockOtros = (otros?.stock ?? []).filter((p) => p.varianteId === f.varianteId && !f.solicitudes.some((x) => x.id === p.id));
    return { pedidosOtros, stockOtros };
  }

  /** Ids y totales que realmente se van a mandar para un producto (lo elegido + lo incluido de la otra lista). */
  function tomarDe(f: Fila) {
    const { pedidosOtros, stockOtros } = extrasDe(f);
    const pedidosFinal = [...f.pedidos, ...(incluirVentas[f.varianteId] !== false ? pedidosOtros : [])];
    const solicitudesFinal = [...f.solicitudes, ...(incluirSolicitudes[f.varianteId] !== false ? stockOtros : [])];
    return { pedidosFinal, solicitudesFinal };
  }

  const sinProveedor = filas.filter((f) => !proveedorPor[f.varianteId]);
  const cantidadNotas = new Set(filas.map((f) => proveedorPor[f.varianteId]).filter(Boolean)).size;

  async function handleCrear() {
    if (sinProveedor.length > 0) {
      setError("Elegí el proveedor de cada producto.");
      return;
    }
    setError("");
    setGuardando(true);
    try {
      const porProveedor = new Map<string, { varianteId: string; asignacionIds: string[]; solicitudLineaIds: string[]; cantidadExtra: number }[]>();
      for (const f of filas) {
        const prov = proveedorPor[f.varianteId];
        const { pedidosFinal, solicitudesFinal } = tomarDe(f);
        const lista = porProveedor.get(prov) ?? [];
        lista.push({
          varianteId: f.varianteId,
          asignacionIds: pedidosFinal.map((p) => p.id),
          solicitudLineaIds: solicitudesFinal.map((p) => p.id),
          cantidadExtra: extraPor[f.varianteId] ?? 0,
        });
        porProveedor.set(prov, lista);
      }
      const resultado = await crearComprasDesdeFaltantes({
        grupos: Array.from(porProveedor.entries()).map(([proveedorId, lineasGrupo]) => ({ proveedorId, lineas: lineasGrupo })),
      });
      setCreadas(resultado);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  if (creadas) {
    return (
      <Modal title="Compras creadas" onClose={onCreated} maxWidth={560}>
        <p className="cell-muted" style={{ marginTop: 0 }}>
          Se crearon {creadas.length} nota{creadas.length === 1 ? "" : "s"} de compra en borrador, ya ligadas. Revisa los precios y apruébalas.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {creadas.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span>
                <strong>{c.codigo}</strong> · {c.proveedor?.nombre ?? "—"} · {c.lineas} producto{c.lineas === 1 ? "" : "s"}, {c.unidades} unidades
              </span>
              <Link href={`/dashboard/proformas/${c.id}`} className="action-btn">
                Abrir
              </Link>
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button type="button" className="button" onClick={onCreated}>
            Listo
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Crear compras" onClose={onClose} maxWidth={860}>
      <p className="cell-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Se crea una nota de compra por proveedor con lo que piden las ventas y las solicitudes de stock. Puedes sumar unidades extra para stock.
      </p>
      <div className="table-scroll">
        <table className="table table-minimal table-compact">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="num">Ventas</th>
              <th className="num">Solicitudes</th>
              <th className="num">+ Stock</th>
              <th className="num">Total</th>
              <th style={{ minWidth: 190 }}>Proveedor</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const { pedidosOtros, stockOtros } = extrasDe(f);
              const { pedidosFinal, solicitudesFinal } = tomarDe(f);
              const ventas = suma(pedidosFinal);
              const solic = suma(solicitudesFinal);
              const extra = extraPor[f.varianteId] ?? 0;
              return (
                <tr key={f.varianteId}>
                  <td>
                    <span className="cell-primary">{f.nombre}</span>
                    {f.marca && <div className="cell-muted" style={{ fontSize: 12 }}>{f.marca}</div>}
                  </td>
                  <td className="num">
                    {suma(f.pedidos)}
                    {pedidosOtros.length > 0 && (
                      <label className="cell-muted" style={{ display: "block", fontSize: 11, fontWeight: 400, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={incluirVentas[f.varianteId] !== false}
                          onChange={(e) => setIncluirVentas((prev) => ({ ...prev, [f.varianteId]: e.target.checked }))}
                        />{" "}
                        + {suma(pedidosOtros)} de otras ventas
                      </label>
                    )}
                  </td>
                  <td className="num">
                    {suma(f.solicitudes)}
                    {stockOtros.length > 0 && (
                      <label className="cell-muted" style={{ display: "block", fontSize: 11, fontWeight: 400, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={incluirSolicitudes[f.varianteId] !== false}
                          onChange={(e) => setIncluirSolicitudes((prev) => ({ ...prev, [f.varianteId]: e.target.checked }))}
                        />{" "}
                        + {suma(stockOtros)} de otras solicitudes
                      </label>
                    )}
                  </td>
                  <td className="num">
                    <input
                      className="field"
                      type="number"
                      min={0}
                      value={extra}
                      aria-label={`Unidades extra de ${f.nombre}`}
                      onChange={(e) => setExtraPor((prev) => ({ ...prev, [f.varianteId]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                      style={{ width: 70, textAlign: "center" }}
                    />
                  </td>
                  <td className="num cell-primary">{ventas + solic + extra}</td>
                  <td>
                    <select
                      className="field"
                      value={proveedorPor[f.varianteId] ?? ""}
                      onChange={(e) => setProveedorPor((prev) => ({ ...prev, [f.varianteId]: e.target.value }))}
                    >
                      <option value="">— Elegir proveedor —</option>
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="form-actions">
        <button type="button" className="link-button" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="button" onClick={handleCrear} disabled={guardando || sinProveedor.length > 0}>
          {guardando ? "Creando..." : `Crear ${cantidadNotas || ""} compra${cantidadNotas === 1 ? "" : "s"}`.replace("  ", " ")}
        </button>
      </div>
    </Modal>
  );
}
