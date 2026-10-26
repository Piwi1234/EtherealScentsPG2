"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, crearComprasDesdeFaltantes, getProveedores, getSugerenciasCompra } from "../../lib/api";
import type { CompraCreada, Proveedor, SeguimientoLinea } from "../../lib/types";
import { Modal } from "../Modal";

type Fila = {
  varianteId: string;
  nombre: string;
  marca: string | null;
  faltan: number;
  asignacionIds: string[];
};

/**
 * Arma una nota de compra por proveedor desde los faltantes elegidos en Seguimiento. Cada producto
 * suma lo que falta en las ventas y, si quieres, unidades extra para stock; el proveedor arranca con el
 * último al que se le compró ese producto. Las notas se crean en borrador y ya quedan ligadas a las ventas.
 */
export function CrearComprasModal({
  lineas,
  onClose,
  onCreated,
}: {
  lineas: SeguimientoLinea[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorPor, setProveedorPor] = useState<Record<string, string>>({});
  const [extraPor, setExtraPor] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [creadas, setCreadas] = useState<CompraCreada[] | null>(null);

  // Un renglón por producto, con la suma de lo que falta en todas las ventas elegidas.
  const filas = useMemo(() => {
    const porVariante = new Map<string, Fila>();
    for (const l of lineas) {
      const v = l.proformaDetalle.variante;
      const f = porVariante.get(v.id) ?? { varianteId: v.id, nombre: v.product.name, marca: v.product.brand?.name ?? null, faltan: 0, asignacionIds: [] };
      f.faltan += l.cantidad;
      f.asignacionIds.push(l.id);
      porVariante.set(v.id, f);
    }
    return Array.from(porVariante.values());
  }, [lineas]);

  useEffect(() => {
    getProveedores({ activo: "true", pageSize: 500 })
      .then((p) => setProveedores(p.items))
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
    getSugerenciasCompra(filas.map((f) => f.varianteId))
      .then((sugeridos) => setProveedorPor((prev) => ({ ...sugeridos, ...prev })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const porProveedor = new Map<string, { varianteId: string; asignacionIds: string[]; cantidadExtra: number }[]>();
      for (const f of filas) {
        const prov = proveedorPor[f.varianteId];
        const lista = porProveedor.get(prov) ?? [];
        lista.push({ varianteId: f.varianteId, asignacionIds: f.asignacionIds, cantidadExtra: extraPor[f.varianteId] ?? 0 });
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
          Se crearon {creadas.length} nota{creadas.length === 1 ? "" : "s"} de compra en borrador, ya ligadas a las ventas. Revisa los precios y apruébalas.
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
    <Modal title="Crear compras" onClose={onClose} maxWidth={760}>
      <p className="cell-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Se crea una nota de compra por proveedor con lo que falta en las ventas elegidas. Puedes sumar unidades extra para stock.
      </p>
      <div className="table-scroll">
        <table className="table table-minimal table-compact">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="num">Faltan</th>
              <th className="num">+ Stock</th>
              <th style={{ minWidth: 190 }}>Proveedor</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.varianteId}>
                <td>
                  <span className="cell-primary">{f.nombre}</span>
                  {f.marca && <div className="cell-muted" style={{ fontSize: 12 }}>{f.marca}</div>}
                </td>
                <td className="num">{f.faltan}</td>
                <td className="num">
                  <input
                    className="field"
                    type="number"
                    min={0}
                    value={extraPor[f.varianteId] ?? 0}
                    aria-label={`Unidades extra de ${f.nombre}`}
                    onChange={(e) => setExtraPor((prev) => ({ ...prev, [f.varianteId]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                    style={{ width: 70, textAlign: "center" }}
                  />
                </td>
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
            ))}
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
