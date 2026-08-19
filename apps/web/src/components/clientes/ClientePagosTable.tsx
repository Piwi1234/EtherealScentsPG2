"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, getPagosCliente } from "../../lib/api";
import type { Page, PagoCliente } from "../../lib/types";
import { formatMonto } from "../../lib/moneda";

const PAGE_SIZE = 10;

function formatFecha(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

/** Historial de pagos de un cliente: todo movimiento de cartera ligado a sus ventas (adelanto, cobro
 * de Cuenta por Cobrar, y el reverso si se anuló una venta) — puede abarcar varias carteras, por eso
 * no hay una columna de saldo acumulado como en el libro de caja de una sola cartera. */
export function ClientePagosTable({ clienteId }: { clienteId: string }) {
  const [data, setData] = useState<Page<PagoCliente> | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getPagosCliente(clienteId, { page: pageNum, limit: PAGE_SIZE })
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [clienteId, pageNum]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  if (loading) {
    return <p className="cell-muted">Cargando...</p>;
  }

  if (!data || data.items.length === 0) {
    return <p className="cell-muted">Este cliente todavía no registra pagos.</p>;
  }

  return (
    <>
      <div className="table-scroll">
        <table className="table table-minimal">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proforma</th>
              <th>Cartera</th>
              <th>Detalle</th>
              <th className="num">Ingreso</th>
              <th className="num">Gasto</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((pago) => (
              <tr key={pago.id}>
                <td className="cell-muted">{formatFecha(pago.fecha)}</td>
                <td>
                  <Link href={`/dashboard/proformas/${pago.proforma.id}`} className="link-button">
                    {pago.proforma.codigo}
                  </Link>
                </td>
                <td className="cell-muted">{pago.cartera.nombre}</td>
                <td>{pago.detalle}</td>
                <td className="num">{pago.naturaleza === "INGRESO" ? formatMonto(pago.monto, pago.cartera.moneda) : "—"}</td>
                <td className="num">{pago.naturaleza === "GASTO" ? formatMonto(pago.monto, pago.cartera.moneda) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className={`pagination-btn${pageNum <= 1 ? " disabled" : ""}`}
            disabled={pageNum <= 1}
            onClick={() => setPageNum((p) => p - 1)}
          >
            ← Anterior
          </button>
          <span className="pagination-info">
            Página {pageNum} de {totalPages}
          </span>
          <button
            type="button"
            className={`pagination-btn${pageNum >= totalPages ? " disabled" : ""}`}
            disabled={pageNum >= totalPages}
            onClick={() => setPageNum((p) => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </>
  );
}
