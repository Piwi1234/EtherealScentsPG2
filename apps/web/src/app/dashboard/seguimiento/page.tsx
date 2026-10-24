import { Suspense } from "react";
import Link from "next/link";
import { apiGetServer } from "../../../lib/api-server";
import type { Category, Empresa, Page, SeguimientoLinea, SeguimientoStockLinea } from "../../../lib/types";
import { SeguimientoFiltros } from "../../../components/proformas/SeguimientoFiltros";
import { SeguimientoPendienteTable } from "../../../components/proformas/SeguimientoPendienteTable";
import { SeguimientoStockTable } from "../../../components/proformas/SeguimientoStockTable";

const PAGE_SIZE = 20;

export default async function SeguimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; estado?: string; empresaId?: string; categoryId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const vista: "pedidos" | "stock" = params.vista === "stock" ? "stock" : "pedidos";
  const currentPage = Math.max(1, Number(params.page ?? "1") || 1);

  const qs = new URLSearchParams();
  qs.set("vista", vista);
  if (params.estado) qs.set("estado", params.estado);
  if (params.empresaId) qs.set("empresaId", params.empresaId);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  qs.set("page", String(currentPage));

  const apiQs = new URLSearchParams(qs);
  apiQs.delete("vista");
  apiQs.set("limit", String(PAGE_SIZE));

  let pedidos: Page<SeguimientoLinea> | null = null;
  let stock: Page<SeguimientoStockLinea> | null = null;
  let error = "";
  try {
    // Antes de elegir categoría no cargamos productos — solo los conteos generales de abajo.
    if (params.categoryId) {
      if (vista === "pedidos") pedidos = await apiGetServer<Page<SeguimientoLinea>>(`/proformas/seguimiento?${apiQs.toString()}`);
      else stock = await apiGetServer<Page<SeguimientoStockLinea>>(`/proformas/seguimiento/stock?${apiQs.toString()}`);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const [empresasPage, categories, sinCompra, stockPedido] = await Promise.all([
    apiGetServer<Page<Empresa>>("/empresas?pageSize=100"),
    apiGetServer<Category[]>("/categories"),
    apiGetServer<Page<SeguimientoLinea>>("/proformas/seguimiento?estado=SIN_COMPRA&limit=1"),
    apiGetServer<Page<SeguimientoStockLinea>>("/proformas/seguimiento/stock?limit=1"),
  ]);

  const data = vista === "pedidos" ? pedidos : stock;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function pageHref(page: number): string {
    const next = new URLSearchParams(qs);
    next.set("page", String(page));
    return `/dashboard/seguimiento?${next.toString()}`;
  }

  // Cambiar de pestaña conserva categoría/empresa pero descarta el estado (cada pestaña tiene los suyos).
  function tabHref(target: "pedidos" | "stock"): string {
    const next = new URLSearchParams();
    next.set("vista", target);
    if (params.empresaId) next.set("empresaId", params.empresaId);
    if (params.categoryId) next.set("categoryId", params.categoryId);
    return `/dashboard/seguimiento?${next.toString()}`;
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Seguimiento</h1>
      </div>

      <div className="pill-group" style={{ marginBottom: 12 }}>
        <Link href={tabHref("pedidos")} className={vista === "pedidos" ? "action-btn" : "link-button"} style={vista === "pedidos" ? { fontWeight: 700 } : undefined}>
          Pedidos de clientes
          <span className="cell-muted" style={{ marginLeft: 6, fontSize: 12 }}>
            {sinCompra.total} sin compra
          </span>
        </Link>
        <Link href={tabHref("stock")} className={vista === "stock" ? "action-btn" : "link-button"} style={vista === "stock" ? { fontWeight: 700 } : undefined}>
          Stock pedido
          <span className="cell-muted" style={{ marginLeft: 6, fontSize: 12 }}>
            {stockPedido.total} por llegar
          </span>
        </Link>
      </div>

      <p className="cell-muted" style={{ marginTop: 0, marginBottom: 16 }}>
        {vista === "pedidos"
          ? "Lo que falta para completar las notas de venta aprobadas (Procura), con el estado de la compra y el envío que lo cubren."
          : "Compras para reponer stock ya aprobadas que todavía no llegaron."}
      </p>

      <Suspense fallback={null}>
        <SeguimientoFiltros
          key={vista}
          vista={vista}
          initialCategoryId={params.categoryId ?? ""}
          initialEstado={params.estado ?? ""}
          initialEmpresaId={params.empresaId ?? ""}
          categories={categories.filter((c) => c.parentId === null)}
          empresas={empresasPage.items.filter((e) => e.activo)}
        />
      </Suspense>

      {error && <p className="error-text">{error}</p>}

      {!error && !params.categoryId && <p className="cell-muted">Elegí una categoría arriba para ver los productos pendientes.</p>}

      {!error && params.categoryId && vista === "pedidos" && pedidos && <SeguimientoPendienteTable lineas={pedidos.items} />}
      {!error && params.categoryId && vista === "stock" && stock && <SeguimientoStockTable lineas={stock.items} />}

      {!error && params.categoryId && data && totalPages > 1 && (
        <div className="pagination">
          <Link href={pageHref(currentPage - 1)} className={`pagination-btn${currentPage <= 1 ? " disabled" : ""}`} aria-disabled={currentPage <= 1}>
            ← Anterior
          </Link>
          <span className="pagination-info">
            Página {currentPage} de {totalPages}
          </span>
          <Link
            href={pageHref(currentPage + 1)}
            className={`pagination-btn${currentPage >= totalPages ? " disabled" : ""}`}
            aria-disabled={currentPage >= totalPages}
          >
            Siguiente →
          </Link>
        </div>
      )}
    </div>
  );
}
