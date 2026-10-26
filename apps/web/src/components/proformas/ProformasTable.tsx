"use client";

import { useRouter } from "next/navigation";
import type { Proforma } from "../../lib/types";
import { EstadoBadge } from "./EstadoBadge";
import { EntregaBadge } from "./EntregaBadge";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

/** Piezas totales de la proforma (suma de cantidades). Una venta en ml se cuenta por presentaciones
 * (frascos), no por ml; una compra en ml cuenta una unidad por línea. */
function totalProductos(proforma: Proforma): number {
  return proforma.detalles.reduce((total, d) => {
    if (d.presentacionVenta?.cantidadMl) return total + Math.round(d.cantidad / d.presentacionVenta.cantidadMl);
    if (d.variante?.unidad === "ML") return total + 1;
    return total + d.cantidad;
  }, 0);
}

/** El proveedor es por línea, no por proforma entera (una misma compra puede traer productos de
 * varios) — para esta columna compacta del listado se arma un resumen: el nombre si todas las
 * líneas son del mismo, o "Varios (N)" si hay más de uno distinto. */
function proveedoresLabel(proforma: Proforma): string {
  const nombres = Array.from(new Set(proforma.detalles.map((d) => d.proveedor?.nombre).filter((n): n is string => Boolean(n))));
  if (nombres.length === 0) return "—";
  if (nombres.length === 1) return nombres[0];
  return `Varios (${nombres.length})`;
}

export function ProformasTable({ proformas, mostrarVendedor }: { proformas: Proforma[]; mostrarVendedor: boolean }) {
  const router = useRouter();

  return (
    <div className="table-scroll">
    <table className="table table-minimal table-compact">
      <thead>
        <tr>
          <th>Código</th>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Empresa</th>
          <th>Almacén</th>
          <th>Cliente / Proveedor</th>
          {mostrarVendedor && <th>Vendedor</th>}
          {mostrarVendedor && <th>Ciudad</th>}
          <th>Estado</th>
          <th className="num">Productos</th>
        </tr>
      </thead>
      <tbody>
        {proformas.map((proforma) => (
          <tr
            key={proforma.id}
            onClick={() => router.push(`/dashboard/proformas/${proforma.id}`)}
            style={{ cursor: "pointer" }}
          >
            <td className="cell-primary">{proforma.codigo}</td>
            <td className="cell-muted">{formatDate(proforma.fecha)}</td>
            <td className="cell-primary">{proforma.tipo === "VENTA" ? "Venta" : "Compra"}</td>
            <td>{proforma.empresa.nombre}</td>
            <td className="cell-muted">{proforma.almacen?.nombre ?? "—"}</td>
            <td className="cell-muted">
              {proforma.tipo === "VENTA" ? proforma.cliente?.nombre ?? "—" : proveedoresLabel(proforma)}
            </td>
            {mostrarVendedor && <td className="cell-muted">{proforma.tipo === "VENTA" ? proforma.creadoPor.nombre : "—"}</td>}
            {mostrarVendedor && <td className="cell-muted">{proforma.ciudadEntrega?.nombre ?? "—"}</td>}
            <td>
              <EstadoBadge estado={proforma.estado} />
              <EntregaBadge proforma={proforma} />
            </td>
            <td className="num">{totalProductos(proforma)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
