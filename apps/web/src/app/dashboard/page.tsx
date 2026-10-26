"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { NuevaProformaBoton } from "../../components/proformas/NuevaProformaBoton";
import { apiGet } from "../../lib/api";
import type {
  DashCategoriaTotal,
  DashClienteTotal,
  DashCuentasPorCobrar,
  DashIngresoEgresoCartera,
  DashMargenMes,
  DashPendientes,
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
  const [pendientes, setPendientes] = useState<DashPendientes | null>(null);

  useEffect(() => {
    apiGet<Page<Empresa>>("/empresas?pageSize=100")
      .then((p) => setEmpresas(p.items))
      .catch(() => {});
    // Estos 4 no dependen de ningún filtro — se cargan una sola vez.
    apiGet<DashCategoriaTotal[]>("/dashboard/productos-por-categoria").then(setProductosPorCategoria).catch(() => {});
    apiGet<DashStockValorizado>("/dashboard/stock-valorizado").then(setStockValorizado).catch(() => {});
    apiGet<DashSaldoCartera[]>("/dashboard/saldos-cartera").then(setSaldosCartera).catch(() => {});
    apiGet<DashCuentasPorCobrar>("/dashboard/cuentas-por-cobrar").then(setCuentasPorCobrar).catch(() => {});
    apiGet<DashPendientes>("/dashboard/pendientes").then(setPendientes).catch(() => {});
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

  // Las proformas nuevas arrancan con la casa matriz (se puede cambiar después en la cabecera).
  const empresasActivas = empresas.filter((e) => e.activo);
  const empresaPorDefectoId = (empresasActivas.find((e) => e.tipo === "CASA_MATRIZ") ?? empresasActivas[0])?.id ?? "";

  // Indicadores del mes en curso (último mes del rango) contra el anterior.
  const ventasMes = ventasMensuales?.[ventasMensuales.length - 1]?.total ?? null;
  const ventasMesAnterior = ventasMensuales && ventasMensuales.length > 1 ? ventasMensuales[ventasMensuales.length - 2].total : null;
  const comprasMes = comprasMensuales?.[comprasMensuales.length - 1]?.total ?? null;
  const variacionVentas =
    ventasMes !== null && ventasMesAnterior !== null && ventasMesAnterior > 0
      ? Math.round(((ventasMes - ventasMesAnterior) / ventasMesAnterior) * 100)
      : null;

  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const atencion = pendientes
    ? [
        {
          n: pendientes.pedidosSinCompra,
          tono: "warn",
          titulo: `${plural(pendientes.pedidosSinCompra, "pedido", "pedidos")} de clientes sin comprar`,
          detalle: "Faltantes de notas de venta aprobadas",
          href: "/dashboard/seguimiento",
          accion: "Ver seguimiento",
        },
        {
          n: pendientes.enviosEnTransito,
          tono: "info",
          titulo: `${plural(pendientes.enviosEnTransito, "envío", "envíos")} en camino`,
          detalle: `${plural(pendientes.piezasEnTransito, "pieza", "piezas")} por recibir`,
          href: "/dashboard/stock/envios",
          accion: "Recibir",
        },
        {
          n: pendientes.enviosArmando,
          tono: "info",
          titulo: `${plural(pendientes.enviosArmando, "envío", "envíos")} armándose`,
          detalle: "Todavía no salieron",
          href: "/dashboard/stock/envios",
          accion: "Abrir envíos",
        },
        {
          n: pendientes.ventasPorCompletar,
          tono: "ok",
          titulo: `${plural(pendientes.ventasPorCompletar, "venta aprobada", "ventas aprobadas")} por completar`,
          detalle: "Reservadas, falta entregar y cobrar",
          href: "/dashboard/proformas?tipo=VENTA&estado=APROBADA",
          accion: "Ver ventas",
        },
        {
          n: pendientes.borradoresVenta,
          tono: "ok",
          titulo: `${plural(pendientes.borradoresVenta, "borrador", "borradores")} de venta sin aprobar`,
          detalle: `El más antiguo tiene ${plural(pendientes.diasBorradorMasViejo, "día", "días")}`,
          href: "/dashboard/proformas?tipo=VENTA&estado=BORRADOR",
          accion: "Abrir",
        },
        {
          n: pendientes.borradoresCompra,
          tono: "ok",
          titulo: `${plural(pendientes.borradoresCompra, "borrador", "borradores")} de compra sin aprobar`,
          detalle: "Pedidos a proveedores sin confirmar",
          href: "/dashboard/proformas?tipo=COMPRA&estado=BORRADOR",
          accion: "Abrir",
        },
      ].filter((r) => r.n > 0)
    : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Dashboard</h1>
        <div className="dash-acciones">
          <NuevaProformaBoton tipo="VENTA" empresaId={empresaPorDefectoId} variante="primario" />
          <NuevaProformaBoton tipo="COMPRA" empresaId={empresaPorDefectoId} variante="secundario" />
        </div>
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

      <div className="dash-kpis">
        <div className="dash-kpi">
          <span className="dash-kpi-label">Ventas del mes</span>
          <span className="dash-kpi-value">{ventasMes === null ? "—" : bs(ventasMes)}</span>
          <span className={`dash-kpi-note${variacionVentas !== null ? (variacionVentas < 0 ? " neg" : " pos") : ""}`}>
            {variacionVentas === null ? "Sin mes anterior para comparar" : `${variacionVentas > 0 ? "+" : ""}${variacionVentas}% vs. el mes anterior`}
          </span>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Por cobrar</span>
          <span className="dash-kpi-value">{cuentasPorCobrar ? bs(cuentasPorCobrar.totalBs) : "—"}</span>
          <span className="dash-kpi-note">
            {cuentasPorCobrar ? plural(cuentasPorCobrar.cantidad, "cuenta pendiente", "cuentas pendientes") : ""}
          </span>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Compras del mes</span>
          <span className="dash-kpi-value">{comprasMes === null ? "—" : bs(comprasMes)}</span>
          <span className="dash-kpi-note">Aprobadas o completadas</span>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">En tránsito</span>
          <span className="dash-kpi-value">{pendientes ? `${pendientes.piezasEnTransito} pzs` : "—"}</span>
          <span className="dash-kpi-note">{pendientes ? `${plural(pendientes.enviosEnTransito, "envío", "envíos")} en camino` : ""}</span>
        </div>
      </div>

      <div className="card dash-attention">
        <p className="dash-widget-title">Requiere atención</p>
        <p className="dash-widget-note">Lo que está esperando una acción tuya.</p>
        {atencion === null ? (
          <p className="dash-empty">Cargando...</p>
        ) : atencion.length === 0 ? (
          <p className="dash-empty">Todo al día: no hay nada pendiente.</p>
        ) : (
          <div className="dash-attention-list">
            {atencion.map((r) => (
              <Link key={r.titulo} href={r.href} className="dash-attention-row">
                <span className={`dash-attention-dot ${r.tono}`} />
                <span className="dash-attention-text">
                  <b>{r.titulo}</b>
                  <small>{r.detalle}</small>
                </span>
                <span className="dash-attention-go">{r.accion} →</span>
              </Link>
            ))}
          </div>
        )}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
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
