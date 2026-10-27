import { Suspense } from "react";
import Link from "next/link";
import { apiGetServer } from "../../../lib/api-server";
import type { Category, Cliente, Empresa, Page, SeguimientoLinea, SeguimientoStockLinea, SolicitudLineaSeguimiento } from "../../../lib/types";
import { SeguimientoFiltros } from "../../../components/proformas/SeguimientoFiltros";
import { SeguimientoPendienteTable } from "../../../components/proformas/SeguimientoPendienteTable";
import { SeguimientoStockTable } from "../../../components/proformas/SeguimientoStockTable";
import { SeguimientoSolicitudTable } from "../../../components/proformas/SeguimientoSolicitudTable";

const PAGE_SIZE = 20;

export default async function SeguimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; estado?: string; empresaId?: string; categoryId?: string; clienteId?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const vista: "pedidos" | "stock" | "solicitudes" = params.vista === "stock" ? "stock" : params.vista === "solicitudes" ? "solicitudes" : "pedidos";
  const currentPage = Math.max(1, Number(params.page ?? "1") || 1);

  const qs = new URLSearchParams();
  qs.set("vista", vista);
  if (params.estado) qs.set("estado", params.estado);
  if (params.empresaId) qs.set("empresaId", params.empresaId);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (vista === "pedidos" && params.clienteId) qs.set("clienteId", params.clienteId);
  if (params.search?.trim()) qs.set("search", params.search.trim());
  qs.set("page", String(currentPage));

  const apiQs = new URLSearchParams(qs);
  apiQs.delete("vista");
  apiQs.set("limit", String(PAGE_SIZE));

  let pedidos: Page<SeguimientoLinea> | null = null;
  let stock: Page<SeguimientoStockLinea> | null = null;
  let solicitudes: Page<SolicitudLineaSeguimiento> | null = null;
  let error = "";
  try {
    if (vista === "pedidos") pedidos = await apiGetServer<Page<SeguimientoLinea>>(`/proformas/seguimiento?${apiQs.toString()}`);
    else if (vista === "solicitudes") solicitudes = await apiGetServer<Page<SolicitudLineaSeguimiento>>(`/proformas/seguimiento/stock-solicitado?${apiQs.toString()}`);
    else stock = await apiGetServer<Page<SeguimientoStockLinea>>(`/proformas/seguimiento/stock?${apiQs.toString()}`);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // Nombre del cliente filtrado (para mostrarlo en el buscador al recargar la página).
  let clienteNombre = "";
  if (vista === "pedidos" && params.clienteId) {
    clienteNombre = await apiGetServer<Cliente>(`/clientes/${params.clienteId}`).then((c) => c.nombre).catch(() => "");
  }

  const [empresasPage, categories, sinCompra, stockPedido, solicitudesSinCompra] = await Promise.all([
    apiGetServer<Page<Empresa>>("/empresas?pageSize=100"),
    apiGetServer<Category[]>("/categories"),
    apiGetServer<Page<SeguimientoLinea>>("/proformas/seguimiento?estado=SIN_COMPRA&limit=1"),
    apiGetServer<Page<SeguimientoStockLinea>>("/proformas/seguimiento/stock?limit=1"),
    apiGetServer<Page<SolicitudLineaSeguimiento>>("/proformas/seguimiento/stock-solicitado?estado=SIN_COMPRA&limit=1"),
  ]);

  const data = vista === "pedidos" ? pedidos : vista === "solicitudes" ? solicitudes : stock;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function pageHref(page: number): string {
    const next = new URLSearchParams(qs);
    next.set("page", String(page));
    return `/dashboard/seguimiento?${next.toString()}`;
  }

  // Cambiar de pestaña conserva categoría/empresa pero descarta el estado (cada pestaña tiene los suyos).
  function tabHref(target: "pedidos" | "stock" | "solicitudes"): string {
    const next = new URLSearchParams();
    next.set("vista", target);
    if (params.empresaId) next.set("empresaId", params.empresaId);
    if (params.categoryId) next.set("categoryId", params.categoryId);
    if (params.search?.trim()) next.set("search", params.search.trim());
    return `/dashboard/seguimiento?${next.toString()}`;
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Seguimiento</h1>
      </div>

      {/* Pestañas como tarjetas con el conteo grande: lo que se mira siempre es cuánto falta en cada una. */}
      <div className="seg-cards" role="tablist" aria-label="Vista de seguimiento">
        {(
          [
            ["pedidos", "Pedidos de clientes", sinCompra.total, "sin compra"],
            ["solicitudes", "Stock solicitado", solicitudesSinCompra.total, "sin compra"],
            ["stock", "Stock en compra", stockPedido.total, "por llegar"],
          ] as const
        ).map(([destino, titulo, cantidad, nota]) => (
          <Link
            key={destino}
            href={tabHref(destino)}
            role="tab"
            aria-selected={vista === destino}
            className={`seg-card${vista === destino ? " seg-card--on" : ""}${cantidad > 0 ? " seg-card--pending" : ""}`}
          >
            <span className="seg-card-title">{titulo}</span>
            <span className="seg-card-count">{cantidad}</span>
            <span className="seg-card-note">{nota}</span>
          </Link>
        ))}
      </div>

      <p className="cell-muted" style={{ marginTop: 0, marginBottom: 16 }}>
        {vista === "pedidos"
          ? "Lo que falta para completar las notas de venta aprobadas (Procura), con el estado de la compra y el envío que lo cubren."
          : vista === "solicitudes"
            ? "Productos pedidos para inventario en solicitudes de stock, con el estado de la compra y el envío que los cubren."
            : "Lo comprado de más en compras aprobadas que no está ligado a ninguna venta ni solicitud y todavía no llegó."}
      </p>

      <Suspense fallback={null}>
        <SeguimientoFiltros
          key={vista}
          vista={vista}
          initialCategoryId={params.categoryId ?? ""}
          initialEstado={params.estado ?? ""}
          initialEmpresaId={params.empresaId ?? ""}
          initialClienteId={vista === "pedidos" ? params.clienteId ?? "" : ""}
          initialClienteNombre={clienteNombre}
          initialSearch={params.search ?? ""}
          categories={categories.filter((c) => c.parentId === null)}
          empresas={empresasPage.items.filter((e) => e.activo)}
        />
      </Suspense>

      {error && <p className="error-text">{error}</p>}

      {!error && vista === "pedidos" && pedidos && <SeguimientoPendienteTable lineas={pedidos.items} />}
      {!error && vista === "solicitudes" && solicitudes && <SeguimientoSolicitudTable lineas={solicitudes.items} />}
      {!error && vista === "stock" && stock && <SeguimientoStockTable lineas={stock.items} />}

      {!error && data && totalPages > 1 && (
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
