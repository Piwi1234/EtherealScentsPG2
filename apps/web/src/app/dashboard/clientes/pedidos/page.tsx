"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, getBrands, getClientes, getProducts, getProformas, getRegistros } from "../../../../lib/api";
import type { Brand, Cliente, Page, Proforma, Product, RegistroLinea } from "../../../../lib/types";
import { formatAtributosVisibles } from "../../../../components/proformas/AtributosVisibles";
import { ClienteSearchSelect } from "../../../../components/proformas/ClienteSearchSelect";
import { ProductoSearchSelect } from "../../../../components/proformas/ProductoSearchSelect";
import { DateRangeDropdown, type DateSelection } from "../../../../components/DateRangeDropdown";
import { ProformasTable } from "../../../../components/proformas/ProformasTable";

const PAGE_SIZE = 20;
const TODO_EL_TIEMPO: DateSelection = { label: "Todo el tiempo" };

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function money(value: number): string {
  return `Bs ${value.toFixed(2)}`;
}

function atributosLabel(variante: RegistroLinea["variante"]): string | null {
  const opciones = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(variante.product.attributeValues, variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

export default function PedidosClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [vista, setVista] = useState<"productos" | "proformas">("productos");
  const [dateSelection, setDateSelection] = useState<DateSelection>(TODO_EL_TIEMPO);
  const [pageNum, setPageNum] = useState(1);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brandId, setBrandId] = useState("");
  const [productId, setProductId] = useState("");

  const [lineas, setLineas] = useState<Page<RegistroLinea> | null>(null);
  const [proformas, setProformas] = useState<Page<Proforma> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getClientes({ activo: "true", limit: 500 })
      .then((page) => setClientes(page.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getBrands().then(setBrands).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // La lista de productos se acota por marca cuando hay una elegida (igual que en Registros).
  useEffect(() => {
    getProducts({ brandId: brandId || undefined, pageSize: 200 })
      .then((page) => setProducts(page.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [brandId]);

  useEffect(() => {
    if (!clienteId) {
      setLineas(null);
      setProformas(null);
      return;
    }
    setLoading(true);
    if (vista === "productos") {
      getRegistros({
        tipo: "VENTA",
        clienteId,
        fechaDesde: dateSelection.fechaDesde,
        fechaHasta: dateSelection.fechaHasta,
        brandId: brandId || undefined,
        productId: productId || undefined,
        page: pageNum,
        limit: PAGE_SIZE,
      })
        .then(setLineas)
        .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    } else {
      getProformas({
        tipo: "VENTA",
        clienteId,
        fechaDesde: dateSelection.fechaDesde,
        fechaHasta: dateSelection.fechaHasta,
        page: pageNum,
        limit: PAGE_SIZE,
      })
        .then(setProformas)
        .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    }
  }, [clienteId, vista, dateSelection, brandId, productId, pageNum]);

  function handleClienteChange(id: string) {
    setClienteId(id);
    setPageNum(1);
  }

  function handleVistaChange(value: "productos" | "proformas") {
    setVista(value);
    setPageNum(1);
  }

  function handleDateApply(selection: DateSelection) {
    setDateSelection(selection);
    setPageNum(1);
  }

  function handleBrandChange(value: string) {
    setBrandId(value);
    setProductId("");
    setPageNum(1);
  }

  function handleProductChange(value: string) {
    setProductId(value);
    setPageNum(1);
  }

  const data = vista === "productos" ? lineas : proformas;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Pedidos</h1>
      </div>

      <div className="filters-bar">
        <div className="filter-field" style={{ minWidth: 260 }}>
          <label className="filter-label">Cliente</label>
          <ClienteSearchSelect clientes={clientes} value={clienteId} onChange={handleClienteChange} />
        </div>

        {clienteId && (
          <div className="filter-field">
            <label className="filter-label">Vista</label>
            <div className="pill-group">
              <label className="checkbox-row" style={{ cursor: "pointer" }}>
                <input
                  type="radio"
                  name="vista"
                  checked={vista === "productos"}
                  onChange={() => handleVistaChange("productos")}
                />
                Producto por producto
              </label>
              <label className="checkbox-row" style={{ cursor: "pointer" }}>
                <input
                  type="radio"
                  name="vista"
                  checked={vista === "proformas"}
                  onChange={() => handleVistaChange("proformas")}
                />
                Por proforma
              </label>
            </div>
          </div>
        )}

        {clienteId && vista === "productos" && (
          <>
            <DateRangeDropdown onApply={handleDateApply} initialSelection={dateSelection} />

            <div className="filter-field">
              <label className="filter-label">Marca</label>
              <select className="field" value={brandId} onChange={(e) => handleBrandChange(e.target.value)}>
                <option value="">Todas</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label className="filter-label">Producto</label>
              <ProductoSearchSelect products={products} value={productId} onChange={handleProductChange} />
            </div>
          </>
        )}

        {clienteId && vista === "proformas" && (
          <DateRangeDropdown onApply={handleDateApply} initialSelection={dateSelection} />
        )}
      </div>

      {!clienteId && <p className="cell-muted">Elegí un cliente arriba para ver sus pedidos.</p>}

      {clienteId && loading && <p className="cell-muted">Cargando...</p>}

      {clienteId && !loading && data && data.items.length === 0 && <p>No hay pedidos para estos filtros.</p>}

      {clienteId && !loading && vista === "productos" && lineas && lineas.items.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="table table-minimal">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proforma</th>
                  <th>Código</th>
                  <th>Marca</th>
                  <th style={{ minWidth: 220 }}>Producto</th>
                  <th className="num">Cant.</th>
                  <th className="num">Precio unitario Bs</th>
                  <th className="num">Subtotal Bs</th>
                </tr>
              </thead>
              <tbody>
                {lineas.items.map((linea) => {
                  const etiqueta = atributosLabel(linea.variante);
                  return (
                    <tr key={linea.id}>
                      <td className="cell-muted">{formatDate(linea.proforma.fecha)}</td>
                      <td>
                        <Link href={`/dashboard/proformas/${linea.proforma.id}`} className="link-button">
                          {linea.proforma.empresa.nombre}
                        </Link>
                      </td>
                      <td className="cell-code">{linea.variante.product.productCode}</td>
                      <td className="cell-muted">{linea.variante.product.brand?.name ?? "—"}</td>
                      <td className="cell-primary">
                        {linea.variante.product.name}
                        {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
                      </td>
                      <td className="num">{linea.cantidad}</td>
                      <td className="num">{money(Number(linea.precioUnitario ?? 0))}</td>
                      <td className="num cell-primary">{money(Number(linea.subtotal))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {clienteId && !loading && vista === "proformas" && proformas && proformas.items.length > 0 && (
        <div className="table-scroll">
          <ProformasTable proformas={proformas.items} mostrarVendedor={true} />
        </div>
      )}

      {clienteId && !loading && data && data.items.length > 0 && totalPages > 1 && (
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
    </div>
  );
}
