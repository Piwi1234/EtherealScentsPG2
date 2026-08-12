import { Suspense } from "react";
import Link from "next/link";
import { apiGetServer } from "../../../lib/api-server";
import type { Page, Proforma } from "../../../lib/types";
import { ProformasTable } from "../../../components/proformas/ProformasTable";
import { ProformaFiltros } from "../../../components/proformas/ProformaFiltros";

const PAGE_SIZE = 20;

export default async function ProformasPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; estado?: string; creadoPorId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page ?? "1") || 1);

  const qs = new URLSearchParams();
  if (params.tipo) qs.set("tipo", params.tipo);
  if (params.estado) qs.set("estado", params.estado);
  if (params.tipo === "VENTA" && params.creadoPorId) qs.set("creadoPorId", params.creadoPorId);
  qs.set("page", String(currentPage));
  qs.set("limit", String(PAGE_SIZE));

  let data: Page<Proforma> | null = null;
  let error = "";
  try {
    // Sin tipo elegido no cargamos proformas — hay que filtrar primero.
    if (params.tipo) {
      data = await apiGetServer<Page<Proforma>>(`/proformas?${qs.toString()}`);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const vendedores = params.tipo === "VENTA" ? await apiGetServer<{ id: string; nombre: string }[]>("/proformas/vendedores") : [];

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function pageHref(page: number): string {
    const next = new URLSearchParams(qs);
    next.set("page", String(page));
    return `/dashboard/proformas?${next.toString()}`;
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Proformas</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/dashboard/proformas/nueva?tipo=venta" className="btn-cta">
            <span className="btn-cta-icon">+</span> Nueva venta
          </Link>
          <Link href="/dashboard/proformas/nueva?tipo=compra" className="btn-cta">
            <span className="btn-cta-icon">+</span> Nueva compra
          </Link>
        </div>
      </div>

      <Suspense fallback={null}>
        <ProformaFiltros
          initialTipo={params.tipo ?? ""}
          initialEstado={params.estado ?? ""}
          initialCreadoPorId={params.creadoPorId ?? ""}
          vendedores={vendedores}
        />
      </Suspense>

      {error && <p className="error-text">{error}</p>}

      {!error && !params.tipo && (
        <p className="cell-muted">Elegí un tipo arriba para ver las proformas.</p>
      )}

      {!error && params.tipo && data && data.items.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <p style={{ color: "var(--muted)" }}>No hay proformas registradas aún</p>
        </div>
      )}

      {!error && params.tipo && data && data.items.length > 0 && (
        <>
          <ProformasTable proformas={data.items} mostrarVendedor={params.tipo === "VENTA"} />
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
