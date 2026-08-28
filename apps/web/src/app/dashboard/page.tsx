"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/api";
import type {
  DashCategoriaTotal,
  DashClienteTotal,
  DashCuentasPorCobrar,
  DashIngresoEgresoCartera,
  DashMargenMes,
  DashMesTotal,
  DashProveedorCategoriaTotal,
  DashSaldoCartera,
  DashStockValorizado,
  Empresa,
  Page,
} from "../../lib/types";
import { BarChart, RankedBarList, SERIES_COLORS, StatTile } from "../../components/dashboard/charts";

const RANGE_OPTIONS = [
  { value: 6, label: "Últimos 6 meses" },
  { value: 12, label: "Últimos 12 meses" },
  { value: 24, label: "Últimos 24 meses" },
];

function bs(value: number): string {
  return `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" -> primer día de ese mes, a las 00:00. */
function fromRangeMonths(meses: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (meses - 1));
  return d;
}

export default function DashboardPage() {
  const [rangeMonths, setRangeMonths] = useState(12);
  const [empresaId, setEmpresaId] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [topClientesMonth, setTopClientesMonth] = useState(currentMonth());
  const [error, setError] = useState("");

  const [ventasMensuales, setVentasMensuales] = useState<DashMesTotal[] | null>(null);
  const [comprasMensuales, setComprasMensuales] = useState<DashMesTotal[] | null>(null);
  const [proformasAprobadas, setProformasAprobadas] = useState<number | null>(null);
  const [proformasCompletadas, setProformasCompletadas] = useState<DashMesTotal[] | null>(null);
  const [ventasPorCategoria, setVentasPorCategoria] = useState<DashCategoriaTotal[] | null>(null);
  const [topClientes, setTopClientes] = useState<DashClienteTotal[] | null>(null);
  const [margenBruto, setMargenBruto] = useState<DashMargenMes[] | null>(null);
  const [comprasPorProveedor, setComprasPorProveedor] = useState<DashProveedorCategoriaTotal[] | null>(null);
  const [productosPorCategoria, setProductosPorCategoria] = useState<DashCategoriaTotal[] | null>(null);
  const [stockValorizado, setStockValorizado] = useState<DashStockValorizado | null>(null);
  const [saldosCartera, setSaldosCartera] = useState<DashSaldoCartera[] | null>(null);
  const [ingresosEgresos, setIngresosEgresos] = useState<DashIngresoEgresoCartera[] | null>(null);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState<DashCuentasPorCobrar | null>(null);

  useEffect(() => {
    apiGet<Page<Empresa>>("/empresas?pageSize=100")
      .then((p) => setEmpresas(p.items))
      .catch(() => {});
    // Estos 4 no dependen de ningún filtro — se cargan una sola vez.
    apiGet<DashCategoriaTotal[]>("/dashboard/productos-por-categoria").then(setProductosPorCategoria).catch(() => {});
    apiGet<DashStockValorizado>("/dashboard/stock-valorizado").then(setStockValorizado).catch(() => {});
    apiGet<DashSaldoCartera[]>("/dashboard/saldos-cartera").then(setSaldosCartera).catch(() => {});
    apiGet<DashCuentasPorCobrar>("/dashboard/cuentas-por-cobrar").then(setCuentasPorCobrar).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ meses: String(rangeMonths) });
    if (empresaId) params.set("empresaId", empresaId);
    apiGet<DashMesTotal[]>(`/dashboard/ventas-mensuales?${params.toString()}`).then(setVentasMensuales).catch((e) => setError(String(e)));
    apiGet<DashMesTotal[]>(`/dashboard/compras-mensuales?${params.toString()}`).then(setComprasMensuales).catch((e) => setError(String(e)));
  }, [rangeMonths, empresaId]);

  useEffect(() => {
    const from = fromRangeMonths(rangeMonths).toISOString();
    const params = new URLSearchParams({ from });
    apiGet<{ cantidad: number }>(`/dashboard/proformas-aprobadas?${params.toString()}`)
      .then((r) => setProformasAprobadas(r.cantidad))
      .catch(() => {});
    apiGet<DashMesTotal[]>(`/dashboard/proformas-completadas-por-mes?${params.toString()}`).then(setProformasCompletadas).catch(() => {});
    apiGet<DashCategoriaTotal[]>(`/dashboard/ventas-por-categoria?${params.toString()}`).then(setVentasPorCategoria).catch(() => {});
    apiGet<DashMargenMes[]>(`/dashboard/margen-bruto?${params.toString()}`).then(setMargenBruto).catch(() => {});
    apiGet<DashProveedorCategoriaTotal[]>(`/dashboard/compras-por-proveedor-categoria?${params.toString()}`)
      .then(setComprasPorProveedor)
      .catch(() => {});
    apiGet<DashIngresoEgresoCartera[]>(`/dashboard/ingresos-egresos?${params.toString()}`).then(setIngresosEgresos).catch(() => {});
  }, [rangeMonths]);

  useEffect(() => {
    apiGet<DashClienteTotal[]>(`/dashboard/top-clientes?month=${topClientesMonth}`).then(setTopClientes).catch(() => {});
  }, [topClientesMonth]);

  const ventasSeries = useMemo(
    () => (ventasMensuales ? [{ label: "Ventas", values: ventasMensuales.map((m) => m.total), color: SERIES_COLORS[0] }] : []),
    [ventasMensuales],
  );
  const comprasSeries = useMemo(
    () => (comprasMensuales ? [{ label: "Compras", values: comprasMensuales.map((m) => m.total), color: SERIES_COLORS[1] }] : []),
    [comprasMensuales],
  );
  const proformasSeries = useMemo(
    () => (proformasCompletadas ? [{ label: "Completadas", values: proformasCompletadas.map((m) => m.total), color: SERIES_COLORS[2] }] : []),
    [proformasCompletadas],
  );
  const margenSeries = useMemo(
    () =>
      margenBruto
        ? [
            { label: "Ingresos", values: margenBruto.map((m) => m.ingresos), color: SERIES_COLORS[0] },
            { label: "Costo", values: margenBruto.map((m) => m.costos), color: SERIES_COLORS[7] },
            { label: "Margen", values: margenBruto.map((m) => m.margen), color: SERIES_COLORS[2] },
          ]
        : [],
    [margenBruto],
  );

  // Ingresos/egresos por cartera: cada cartera tiene su propia moneda (no se pueden sumar entre
  // ellas), así que se arma un mini-gráfico aparte por cartera (small multiples) en vez de uno solo.
  const ingresosEgresosPorCartera = useMemo(() => {
    if (!ingresosEgresos) return [];
    const byCartera = new Map<string, { cartera: string; moneda: string; meses: Map<string, { ingresos: number; egresos: number }> }>();
    for (const row of ingresosEgresos) {
      const entry = byCartera.get(row.carteraId) ?? { cartera: row.cartera, moneda: row.moneda, meses: new Map() };
      entry.meses.set(row.mes, { ingresos: row.ingresos, egresos: row.egresos });
      byCartera.set(row.carteraId, entry);
    }
    const allMonths = Array.from(new Set(ingresosEgresos.map((r) => r.mes))).sort();
    return Array.from(byCartera.values()).map((c) => ({
      cartera: c.cartera,
      moneda: c.moneda,
      categories: allMonths,
      series: [
        { label: "Ingresos", values: allMonths.map((m) => c.meses.get(m)?.ingresos ?? 0), color: SERIES_COLORS[2] },
        { label: "Egresos", values: allMonths.map((m) => c.meses.get(m)?.egresos ?? 0), color: SERIES_COLORS[7] },
      ],
    }));
  }, [ingresosEgresos]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Dashboard</h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="dash-filters">
        <div className="dash-filter-field">
          <label>Período</label>
          <select className="field" value={rangeMonths} onChange={(e) => setRangeMonths(Number(e.target.value))}>
            {RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="dash-filter-field">
          <label>Empresa (ventas/compras mensuales)</label>
          <select className="field" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            <option value="">Todas</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ================= Ventas ================= */}
      <p className="dash-section-title">Ventas</p>
      <div className="dash-grid">
        <div className="card">
          <p className="dash-widget-title">Ventas mensuales</p>
          <p className="dash-widget-note">Total en Bs por mes (proformas aprobadas o completadas).</p>
          {ventasMensuales ? (
            <BarChart categories={ventasMensuales.map((m) => m.mes)} series={ventasSeries} formatValue={bs} />
          ) : (
            <p className="dash-empty">Cargando...</p>
          )}
        </div>
        <div className="card">
          <p className="dash-widget-title">Ventas por categoría</p>
          <p className="dash-widget-note">Total en Bs en el período elegido.</p>
          {ventasPorCategoria ? (
            <RankedBarList items={ventasPorCategoria.map((c) => ({ label: c.categoria, value: c.total }))} formatValue={bs} />
          ) : (
            <p className="dash-empty">Cargando...</p>
          )}
        </div>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <p className="dash-widget-title">Top 10 clientes</p>
              <p className="dash-widget-note">Total comprado en el mes elegido.</p>
            </div>
            <input
              className="field"
              type="month"
              value={topClientesMonth}
              onChange={(e) => setTopClientesMonth(e.target.value)}
              style={{ width: 150 }}
            />
          </div>
          {topClientes ? (
            <RankedBarList items={topClientes.map((c) => ({ label: c.cliente, value: c.total }))} formatValue={bs} />
          ) : (
            <p className="dash-empty">Cargando...</p>
          )}
        </div>
        <div className="card">
          <p className="dash-widget-title">Proformas aprobadas</p>
          <p className="dash-widget-note">En el período elegido.</p>
          <StatTile label="Cantidad" value={proformasAprobadas === null ? "—" : String(proformasAprobadas)} color={SERIES_COLORS[0]} />
        </div>
        <div className="card">
          <p className="dash-widget-title">Proformas completadas por mes</p>
          {proformasCompletadas ? (
            <BarChart
              categories={proformasCompletadas.map((m) => m.mes)}
              series={proformasSeries}
              formatValue={(v) => String(v)}
            />
          ) : (
            <p className="dash-empty">Cargando...</p>
          )}
        </div>
      </div>

      {/* ================= Compras ================= */}
      <p className="dash-section-title">Compras</p>
      <div className="dash-grid">
        <div className="card">
          <p className="dash-widget-title">Compras mensuales</p>
          <p className="dash-widget-note">Total en Bs por mes (proformas aprobadas o completadas).</p>
          {comprasMensuales ? (
            <BarChart categories={comprasMensuales.map((m) => m.mes)} series={comprasSeries} formatValue={bs} />
          ) : (
            <p className="dash-empty">Cargando...</p>
          )}
        </div>
        <div className="card">
          <p className="dash-widget-title">Compras por proveedor y categoría</p>
          <p className="dash-widget-note">Total en Bs en el período elegido.</p>
          {comprasPorProveedor ? (
            <RankedBarList
              items={comprasPorProveedor.map((c) => ({ label: c.proveedor, sublabel: c.categoria, value: c.total }))}
              formatValue={bs}
            />
          ) : (
            <p className="dash-empty">Cargando...</p>
          )}
        </div>
      </div>

      {/* ================= Stock ================= */}
      <p className="dash-section-title">Stock</p>
      <div className="dash-grid">
        <div className="card">
          <p className="dash-widget-title">Productos por categoría</p>
          {productosPorCategoria ? (
            <RankedBarList items={productosPorCategoria.map((c) => ({ label: c.categoria, value: c.total }))} formatValue={(v) => String(v)} />
          ) : (
            <p className="dash-empty">Cargando...</p>
          )}
        </div>
        <div className="card">
          <p className="dash-widget-title">Valor de stock</p>
          <p className="dash-widget-note">A costo promedio ponderado por variante.</p>
          <div className="dash-stat-row">
            <StatTile label="Disponible" value={stockValorizado ? bs(stockValorizado.disponibleBs) : "—"} color={SERIES_COLORS[2]} />
            <StatTile label="Reservado" value={stockValorizado ? bs(stockValorizado.reservadoBs) : "—"} color={SERIES_COLORS[4]} />
          </div>
        </div>
      </div>

      {/* ================= Finanzas ================= */}
      <p className="dash-section-title">Finanzas</p>
      <div className="dash-grid dash-grid--wide">
        <div className="card">
          <p className="dash-widget-title">Margen bruto</p>
          <p className="dash-widget-note">Ingresos por venta − costo real de lo vendido (lotes consumidos), por mes.</p>
          {margenBruto ? (
            margenBruto.length > 0 ? (
              <BarChart categories={margenBruto.map((m) => m.mes)} series={margenSeries} formatValue={bs} />
            ) : (
              <p className="dash-empty">Sin ventas con costo registrado en el período elegido.</p>
            )
          ) : (
            <p className="dash-empty">Cargando...</p>
          )}
        </div>
        <div className="card">
          <p className="dash-widget-title">Cuentas por cobrar</p>
          <p className="dash-widget-note">Pendientes de cobro, en Bs.</p>
          <StatTile
            label="Total"
            value={cuentasPorCobrar ? bs(cuentasPorCobrar.totalBs) : "—"}
            sublabel={cuentasPorCobrar ? `${cuentasPorCobrar.cantidad} cuenta${cuentasPorCobrar.cantidad === 1 ? "" : "s"}` : undefined}
            color={SERIES_COLORS[7]}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 32 }}>
        <p className="dash-widget-title">Saldo por cartera</p>
        {saldosCartera ? (
          saldosCartera.length > 0 ? (
            <div className="dash-stat-row">
              {saldosCartera.map((c, i) => (
                <StatTile key={c.id} label={`${c.nombre} (${c.moneda})`} value={c.saldo.toLocaleString("es-BO")} color={SERIES_COLORS[i % SERIES_COLORS.length]} />
              ))}
            </div>
          ) : (
            <p className="dash-empty">No hay carteras activas.</p>
          )
        ) : (
          <p className="dash-empty">Cargando...</p>
        )}
      </div>

      <div className="card">
        <p className="dash-widget-title">Ingresos y egresos por cartera</p>
        <p className="dash-widget-note">Por mes, en la moneda propia de cada cartera (no se convierten entre sí).</p>
        {ingresosEgresos ? (
          ingresosEgresosPorCartera.length > 0 ? (
            <div className="dash-grid">
              {ingresosEgresosPorCartera.map((c) => (
                <div key={c.cartera}>
                  <p className="dash-widget-title" style={{ fontSize: 12.5 }}>
                    {c.cartera} ({c.moneda})
                  </p>
                  <BarChart categories={c.categories} series={c.series} formatValue={(v) => v.toLocaleString("es-BO")} />
                </div>
              ))}
            </div>
          ) : (
            <p className="dash-empty">Sin movimientos en el período elegido.</p>
          )
        ) : (
          <p className="dash-empty">Cargando...</p>
        )}
      </div>
    </div>
  );
}
