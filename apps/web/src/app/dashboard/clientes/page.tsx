import { Suspense } from "react";
import Link from "next/link";
import { apiGetServer } from "../../../lib/api-server";
import type { Cliente, Page } from "../../../lib/types";
import { ClientesTable } from "../../../components/clientes/ClientesTable";
import { ClienteFiltros } from "../../../components/clientes/ClienteFiltros";

const PAGE_SIZE = 20;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; activo?: string; page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page ?? "1") || 1);

  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.activo) qs.set("activo", params.activo);
  qs.set("page", String(currentPage));
  qs.set("limit", String(PAGE_SIZE));

  let data: Page<Cliente> | null = null;
  let error = "";
  try {
    data = await apiGetServer<Page<Cliente>>(`/clientes?${qs.toString()}`);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function pageHref(page: number): string {
    const next = new URLSearchParams(qs);
    next.set("page", String(page));
    return `/dashboard/clientes?${next.toString()}`;
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Clientes</h1>
        <Link href="/dashboard/clientes/nuevo" className="btn-cta">
          <span className="btn-cta-icon">+</span> Nuevo cliente
        </Link>
      </div>

      <Suspense fallback={null}>
        <ClienteFiltros initialSearch={params.search ?? ""} initialActivo={params.activo ?? ""} />
      </Suspense>

      {error && <p className="error-text">{error}</p>}

      {!error && data && data.items.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>No hay clientes registrados aún</p>
          <Link href="/dashboard/clientes/nuevo" className="btn-cta" style={{ display: "inline-flex" }}>
            <span className="btn-cta-icon">+</span> Nuevo cliente
          </Link>
        </div>
      )}

      {!error && data && data.items.length > 0 && (
        <>
          <ClientesTable clientes={data.items} />
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
