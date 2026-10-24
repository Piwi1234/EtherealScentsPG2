import Link from "next/link";
import type { SeguimientoStockLinea } from "../../lib/types";
import { formatAtributosVisibles } from "./AtributosVisibles";
import { LABELS_STOCK } from "./seguimiento-estados";

function formatFecha(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function atributosLabel(variante: SeguimientoStockLinea["variante"]): string | null {
  const opciones = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(variante.product.attributeValues, variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

/** Stock pedido: líneas de compra "para stock" ya aprobadas que todavía no llegaron. */
export function SeguimientoStockTable({ lineas }: { lineas: SeguimientoStockLinea[] }) {
  if (lineas.length === 0) {
    return <p className="cell-muted">No hay compras para stock pendientes de recibir con estos filtros.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="table table-minimal">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Compra</th>
            <th>Proveedor</th>
            <th>Marca</th>
            <th style={{ minWidth: 220 }}>Producto</th>
            <th className="num">Cant.</th>
            <th>Estado</th>
            <th>Envío</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((linea) => {
            const etiqueta = atributosLabel(linea.variante);
            const envio = linea.proforma.envio;
            return (
              <tr key={linea.id}>
                <td className="cell-muted">{formatFecha(linea.proforma.fecha)}</td>
                <td>
                  <Link href={`/dashboard/proformas/${linea.proforma.id}`} className="link-button">
                    {linea.proforma.codigo}
                  </Link>
                </td>
                <td className="cell-muted">{linea.proveedor?.nombre ?? "—"}</td>
                <td className="cell-muted">{linea.variante.product.brand?.name ?? "—"}</td>
                <td className="cell-primary">
                  {linea.variante.product.name}
                  {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
                </td>
                <td className="num">{linea.cantidad}</td>
                <td>
                  <span className={`badge ${linea.estadoStock === "EN_TRANSITO" ? "badge-accent" : "badge-muted"}`}>
                    {LABELS_STOCK[linea.estadoStock]}
                  </span>
                </td>
                <td className="cell-muted">
                  {envio ? (
                    <>
                      <Link href={`/dashboard/stock/envios/${envio.id}`} className="link-button">
                        {envio.codigo}
                      </Link>
                      <div style={{ fontSize: 12 }}>→ {envio.almacenDestino.nombre}</div>
                    </>
                  ) : (
                    "Sin envío"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
