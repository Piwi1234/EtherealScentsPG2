"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Proforma } from "../../lib/types";
import { EstadoBadge } from "./EstadoBadge";
import { EntregaBadge } from "./EntregaBadge";
import { formatAtributosVisibles } from "./AtributosVisibles";

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

function atributosDe(d: Proforma["detalles"][number]): string {
  const opciones = d.variante.options.map((o) => o.optionValue.value);
  const heredados = formatAtributosVisibles(d.variante.product.attributeValues, d.variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(" · ") : "—";
}

/** Precio (venta) o costo (compra) unitario en Bs; en compras se convierte con el tipo de cambio de la proforma. */
function unitarioBs(proforma: Proforma, d: Proforma["detalles"][number]): number | null {
  if (proforma.tipo === "VENTA") return d.precioUnitario !== null ? Number(d.precioUnitario) : null;
  const tc = proforma.tipoCambioProf ? Number(proforma.tipoCambioProf) : null;
  if (!tc) return null;
  return (Number(d.precioCompra ?? 0) + Number(d.costoEnvio ?? 0) + Number(d.costoSeguridad ?? 0) + Number(d.costoLogistica ?? 0)) * tc;
}

function subtotalBs(proforma: Proforma, d: Proforma["detalles"][number]): number | null {
  if (proforma.tipo === "VENTA") return Number(d.subtotal);
  const tc = proforma.tipoCambioProf ? Number(proforma.tipoCambioProf) : null;
  return tc ? Number(d.subtotal) * tc : null;
}

/**
 * `desplegable`: cada fila se puede abrir con un clic para ver los productos de la proforma (como en Registros); el
 * código lleva al detalle. Sin `desplegable`, la fila entera lleva al detalle.
 */
export function ProformasTable({ proformas, mostrarVendedor, desplegable = false }: { proformas: Proforma[]; mostrarVendedor: boolean; desplegable?: boolean }) {
  const router = useRouter();
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const columnas = 8 + (mostrarVendedor ? 2 : 0);

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
          <Fragment key={proforma.id}>
          <tr
            className={desplegable ? "reg-group" : undefined}
            aria-expanded={desplegable ? abiertas.has(proforma.id) : undefined}
            onClick={() => (desplegable ? alternar(proforma.id) : router.push(`/dashboard/proformas/${proforma.id}`))}
            style={{ cursor: "pointer" }}
          >
            <td className="cell-primary">
              {desplegable && <span className="reg-chevron">{abiertas.has(proforma.id) ? "▾" : "▸"}</span>}
              {desplegable ? (
                <Link href={`/dashboard/proformas/${proforma.id}`} className="link-button" onClick={(e) => e.stopPropagation()}>
                  {proforma.codigo}
                </Link>
              ) : (
                proforma.codigo
              )}
            </td>
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
          {desplegable && abiertas.has(proforma.id) && (
            <tr>
              <td colSpan={columnas} style={{ padding: "4px 12px 12px 34px" }}>
                <table className="table table-minimal table-compact">
                  <thead>
                    <tr>
                      <th>Marca</th>
                      <th style={{ minWidth: 200 }}>Producto</th>
                      <th>Atributos</th>
                      <th className="num">Cant.</th>
                      {proforma.tipo === "COMPRA" && <th>Proveedor</th>}
                      <th className="num">{proforma.tipo === "COMPRA" ? "Costo unit. Bs" : "Precio unit. Bs"}</th>
                      <th className="num">Subtotal Bs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proforma.detalles.map((d) => (
                      <tr key={d.id}>
                        <td className="cell-muted">{d.variante.product.brand?.name ?? "—"}</td>
                        <td className="cell-primary">{d.variante.product.name}</td>
                        <td className="cell-muted">{atributosDe(d)}</td>
                        <td className="num">{d.cantidad}</td>
                        {proforma.tipo === "COMPRA" && <td className="cell-muted">{d.proveedor?.nombre ?? "—"}</td>}
                        <td className="num cell-muted">{unitarioBs(proforma, d)?.toFixed(2) ?? "—"}</td>
                        <td className="num">{subtotalBs(proforma, d)?.toFixed(2) ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          )}
          </Fragment>
        ))}
      </tbody>
    </table>
    </div>
  );
}
