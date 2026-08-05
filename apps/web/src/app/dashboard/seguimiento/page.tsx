import { Suspense } from "react";
import Link from "next/link";
import { apiGetServer } from "../../../lib/api-server";
import type { Empresa, Page, SeguimientoLinea } from "../../../lib/types";
import { SeguimientoFiltros } from "../../../components/proformas/SeguimientoFiltros";
import { SeguimientoPendienteTable } from "../../../components/proformas/SeguimientoPendienteTable";

const PAGE_SIZE = 20;

export default async function SeguimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; tipo?: string; empresaId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page ?? "1") || 1);

  const qs = new URLSearchParams();
  if (params.estado) qs.set("estado", params.estado);
  if (params.tipo) qs.set("tipo", params.tipo);
  if (params.empresaId) qs.set("empresaId", params.empresaId);
  qs.set("page", String(currentPage));
  qs.set("limit", String(PAGE_SIZE));

  let data: Page<SeguimientoLinea> | null = null;
  let error = "";
  try {
    data = await apiGetServer<Page<SeguimientoLinea>>(`/proformas/seguimiento?${qs.toString()}`);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const empresasPage = await apiGetServer<Page<Empresa>>("/empresas?pageSize=100");

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function pageHref(page: number): string {
    const next = new URLSearchParams(qs);
    next.set("page", String(page));
    return `/dashboard/seguimiento?${next.toString()}`;
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Seguimiento</h1>
      </div>
      <p className="cell-muted" style={{ marginTop: -8, marginBottom: 16 }}>
        Todas las líneas de proformas aprobadas o completadas, de cualquier proforma, en un solo lugar.
      </p>

      <Suspense fallback={null}>
        <SeguimientoFiltros
          initialEstado={params.estado ?? ""}
          initialTipo={params.tipo ?? ""}
          initialEmpresaId={params.empresaId ?? ""}
          empresas={empresasPage.items.filter((e) => e.activo)}
        />
      </Suspense>

      {error && <p className="error-text">{error}</p>}

      {!error && data && (
        <>
          <SeguimientoPendienteTable lineas={data.items} />
          {totalPages > 1 && (
            <div className="pagination">
              <Link
                href={pageHref(currentPage - 1)}
                className={`pagination-btn${currentPage <= 1 ? " disabled" : ""}`}
                aria-disabled={currentPage <= 1}
              >
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
        </>
      )}
    </div>
  );
}
