"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, cobrarCuenta, downloadEstadoCuenta, getCarteras, getCuentasPorCobrarPorCliente } from "../../../../lib/api";
import type { Cartera, CuentaPorCobrarConProforma, CuentaPorCobrarGrupo, CuentasPorCobrarPorCliente, EstadoCuentaPorCobrar } from "../../../../lib/types";
import { Modal } from "../../../../components/Modal";
import { EstadoBadge } from "../../../../components/proformas/EstadoBadge";
import { CarteraSelector } from "../../../../components/proformas/selectors";
import { ClienteSearchSelect } from "../../../../components/proformas/ClienteSearchSelect";
import { DateRangeDropdown, type DateSelection } from "../../../../components/DateRangeDropdown";

const PAGE_SIZE = 20;
const TODO_EL_TIEMPO: DateSelection = { label: "Todo el tiempo" };

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function EstadoCuentaBadge({ estado }: { estado: EstadoCuentaPorCobrar }) {
  return (
    <span className={estado === "PENDIENTE" ? "badge badge-accent" : "badge badge-muted"}>
      {estado === "PENDIENTE" ? "Pendiente" : "Completado"}
    </span>
  );
}

const DIA_MS = 24 * 60 * 60 * 1000;
// Una deuda pendiente con más de esta cantidad de días se resalta como atrasada.
const DIAS_ATRASO = 30;

function bs(value: number | string): string {
  return `Bs ${Number(value).toFixed(2)}`;
}

function diasDesde(value: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / DIA_MS));
}

function textoDias(dias: number): string {
  return dias === 0 ? "hoy" : dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

/** Fecha y, debajo, hace cuánto — en rojo si la deuda pendiente ya pasó los DIAS_ATRASO. */
function FechaConAntiguedad({ fecha, pendiente, etiqueta }: { fecha: string; pendiente: boolean; etiqueta?: string }) {
  const dias = diasDesde(fecha);
  return (
    <div>
      <div className="cell-muted">{formatDate(fecha)}</div>
      {pendiente && (
        <div className={`cxc-antiguedad${dias >= DIAS_ATRASO ? " cxc-antiguedad--atraso" : ""}`}>
          {etiqueta ? `${etiqueta} · ` : ""}
          {textoDias(dias)}
        </div>
      )}
    </div>
  );
}

/** Barra de avance del cobro: cuánto del total ya se cobró. */
function AvanceCobro({ total, cobrado }: { total: number; cobrado: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((cobrado / total) * 100)) : 100;
  return (
    <div className="cxc-avance" title={`${pct}% cobrado`}>
      <div className="cxc-avance-barra">
        <div className="cxc-avance-relleno" style={{ width: `${pct}%` }} />
      </div>
      <span className="cxc-avance-pct">{pct}%</span>
    </div>
  );
}

/** Identifica un grupo para desplegarlo: el cliente, o la propia cuenta si la deuda no tiene cliente (cada una es su grupo). */
function claveGrupo(grupo: CuentaPorCobrarGrupo): string {
  return grupo.clienteId ?? `sin-cliente:${grupo.cuentas[0]?.id}`;
}

export default function CuentasPorCobrarPage() {
  const [estado, setEstado] = useState<"" | EstadoCuentaPorCobrar>("PENDIENTE");
  const [clienteId, setClienteId] = useState("");
  const [codigoInput, setCodigoInput] = useState("");
  const [codigo, setCodigo] = useState("");
  const [dateSelection, setDateSelection] = useState<DateSelection>(TODO_EL_TIEMPO);
  const [pageNum, setPageNum] = useState(1);
  const [data, setData] = useState<CuentasPorCobrarPorCliente | null>(null);
  // Grupos (clientes con 2 o más deudas) desplegados — se identifican por clienteId.
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [descargando, setDescargando] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [carterasBs, setCarterasBs] = useState<Cartera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cobrando, setCobrando] = useState<CuentaPorCobrarConProforma | null>(null);

  function load() {
    setLoading(true);
    getCuentasPorCobrarPorCliente({
      estado: estado || undefined,
      clienteId: clienteId || undefined,
      codigo: codigo || undefined,
      fechaDesde: dateSelection.fechaDesde,
      fechaHasta: dateSelection.fechaHasta,
      page: pageNum,
      limit: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [estado, clienteId, codigo, dateSelection, pageNum]);

  useEffect(() => {
    getCarteras({ moneda: "BS", activo: true })
      .then(setCarterasBs)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Búsqueda con debounce: espera a que el usuario deje de tipear antes de disparar el pedido.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCodigo(codigoInput.trim());
      setPageNum(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [codigoInput]);

  function handleEstadoChange(value: string) {
    setEstado(value as "" | EstadoCuentaPorCobrar);
    setPageNum(1);
  }

  function handleClienteChange(id: string) {
    setClienteId(id);
    setPageNum(1);
  }

  function handleDateApply(selection: DateSelection) {
    setDateSelection(selection);
    setPageNum(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  // Todos los clientes son desplegables, aunque tengan una sola deuda.
  const desplegables = data ? data.items.map(claveGrupo) : [];
  const todosAbiertos = desplegables.length > 0 && desplegables.every((id) => abiertos.has(id));

  function alternar(id: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function descargarEstadoCuenta(grupo: CuentaPorCobrarGrupo) {
    if (!grupo.clienteId) return;
    setDescargando(grupo.clienteId);
    setPdfError("");
    try {
      await downloadEstadoCuenta(grupo.clienteId, grupo.cliente?.nombre ?? "cliente", {
        fechaDesde: dateSelection.fechaDesde,
        fechaHasta: dateSelection.fechaHasta,
      });
    } catch (e) {
      setPdfError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setDescargando(null);
    }
  }

  // Una fila por cuenta, dentro de su grupo (sangrada: el nombre del cliente ya está en la fila del grupo).
  function filaCuenta(cuenta: CuentaPorCobrarConProforma) {
    const total = Number(cuenta.montoTotal);
    const saldo = Number(cuenta.montoAdeudado);
    return (
      <tr key={cuenta.id} className="cxc-hija">
        <td className="reg-indent">
          <div className="cxc-nota">
            <Link href={`/dashboard/proformas/${cuenta.proforma.id}`} className="action-btn solicitud-btn" title="Abrir la proforma">
              {cuenta.proforma.codigo}
              <span aria-hidden="true">→</span>
            </Link>
            <EstadoBadge estado={cuenta.proforma.estado} />
          </div>
        </td>
        <td>
          <FechaConAntiguedad fecha={cuenta.proforma.fecha} pendiente={cuenta.estado === "PENDIENTE"} />
        </td>
        <td className="num cell-muted">{bs(total)}</td>
        <td className="num cell-muted">{bs(total - saldo)}</td>
        <td>
          <AvanceCobro total={total} cobrado={total - saldo} />
        </td>
        <td className="num cell-primary">{bs(saldo)}</td>
        <td>
          <EstadoCuentaBadge estado={cuenta.estado} />
        </td>
        <td className="cxc-acciones">
          {cuenta.estado === "PENDIENTE" && (
            <button type="button" className="action-btn" onClick={() => setCobrando(cuenta)}>
              Cobrar
            </button>
          )}
        </td>
      </tr>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Cuentas por Cobrar</h1>
        <p className="cell-muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
          Lo que los clientes todavía deben, agrupado por cliente. Despliega un cliente para cobrar cada deuda o descarga su estado de cuenta en PDF.
        </p>
      </div>

      {data && (
        <div className="cxc-kpis">
          <div className="cxc-kpi cxc-kpi--principal">
            <span className="cxc-kpi-label">Por cobrar</span>
            <span className="cxc-kpi-valor">{bs(data.resumen.montoAdeudado)}</span>
          </div>
          <div className="cxc-kpi">
            <span className="cxc-kpi-label">Cobrado</span>
            <span className="cxc-kpi-valor">{bs(data.resumen.montoCobrado)}</span>
            <span className="cxc-kpi-sub">de {bs(data.resumen.montoTotal)} facturado</span>
          </div>
          <div className="cxc-kpi">
            <span className="cxc-kpi-label">Clientes</span>
            <span className="cxc-kpi-valor">{data.resumen.clientes}</span>
          </div>
          <div className="cxc-kpi">
            <span className="cxc-kpi-label">Deudas</span>
            <span className="cxc-kpi-valor">{data.resumen.cuentas}</span>
          </div>
        </div>
      )}

      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <div className="filter-field">
          <label className="filter-label">Estado</label>
          <select className="field" value={estado} onChange={(e) => handleEstadoChange(e.target.value)}>
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="COMPLETADO">Completado</option>
          </select>
        </div>
        <div className="filter-field">
          <label className="filter-label">N° proforma</label>
          <input
            className="field"
            placeholder="Ej. 4HRNPZW"
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value)}
            style={{ width: 130 }}
          />
        </div>
        <div className="filter-field" style={{ minWidth: 220 }}>
          <label className="filter-label">Cliente</label>
          <ClienteSearchSelect value={clienteId} onChange={handleClienteChange} />
        </div>
        <DateRangeDropdown onApply={handleDateApply} />
      </div>

      {loading ? (
        <p className="cell-muted">Cargando...</p>
      ) : !data || data.items.length === 0 ? (
        <p>No hay cuentas por cobrar para estos filtros.</p>
      ) : (
        <>
          {pdfError && <p className="error-text">{pdfError}</p>}
          {desplegables.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
              <button type="button" className="link-button" onClick={() => setAbiertos(todosAbiertos ? new Set() : new Set(desplegables))}>
                {todosAbiertos ? "Contraer todo" : "Expandir todo"}
              </button>
            </div>
          )}
          <div className="table-scroll">
          <table className="table table-minimal table-compact cxc-tabla">
            <thead>
              <tr>
                <th>Cliente / nota</th>
                <th>Fecha</th>
                <th className="num">Total</th>
                <th className="num">Cobrado</th>
                <th>Avance</th>
                <th className="num">Saldo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((grupo) => {
                const tieneSaldo = Number(grupo.montoAdeudado) > 0;
                const botonPdf = (
                  <button
                    type="button"
                    className="action-btn"
                    disabled={descargando === grupo.clienteId}
                    title="Descargar el estado de cuenta (deudas pendientes) para entregar al cliente"
                    onClick={(e) => {
                      e.stopPropagation();
                      descargarEstadoCuenta(grupo);
                    }}
                  >
                    {descargando === grupo.clienteId ? "Generando..." : "PDF"}
                  </button>
                );
                const clave = claveGrupo(grupo);
                const abierto = abiertos.has(clave);
                const pendientes = grupo.cuentas.filter((c) => c.estado === "PENDIENTE");
                const masAntigua = pendientes.length > 0 ? pendientes.map((c) => c.proforma.fecha).sort()[0] : null;
                return (
                  <Fragment key={clave}>
                    <tr className="reg-group cxc-grupo" onClick={() => alternar(clave)} aria-expanded={abierto}>
                      <td className="reg-group-code">
                        <span className="reg-chevron">{abierto ? "▾" : "▸"}</span>
                        <span className="cell-primary">{grupo.cliente?.nombre ?? "Sin cliente"}</span>
                        <span className="badge badge-muted cxc-cantidad">
                          {grupo.cantidad} {grupo.cantidad === 1 ? "deuda" : "deudas"}
                        </span>
                      </td>
                      <td>
                        {masAntigua ? <FechaConAntiguedad fecha={masAntigua} pendiente etiqueta="la más antigua" /> : <span className="cell-muted">—</span>}
                      </td>
                      <td className="num cell-muted">{bs(grupo.montoTotal)}</td>
                      <td className="num cell-muted">{bs(grupo.montoCobrado)}</td>
                      <td>
                        <AvanceCobro total={Number(grupo.montoTotal)} cobrado={Number(grupo.montoCobrado)} />
                      </td>
                      <td className="num cell-primary">{bs(grupo.montoAdeudado)}</td>
                      <td></td>
                      <td className="cxc-acciones">{grupo.clienteId && tieneSaldo && botonPdf}</td>
                    </tr>
                    {abierto && grupo.cuentas.map((cuenta) => filaCuenta(cuenta))}
                  </Fragment>
                );
              })}
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
      )}

      {cobrando && (
        <CobrarModal
          cuenta={cobrando}
          carterasBs={carterasBs}
          onClose={() => setCobrando(null)}
          onDone={() => {
            setCobrando(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CobrarModal({
  cuenta,
  carterasBs,
  onClose,
  onDone,
}: {
  cuenta: CuentaPorCobrarConProforma;
  carterasBs: Cartera[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [monto, setMonto] = useState(cuenta.montoAdeudado);
  const [carteraId, setCarteraId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function confirmar() {
    const valor = Number(monto);
    if (Number.isNaN(valor) || valor <= 0 || valor > Number(cuenta.montoAdeudado)) {
      setError(`Ingresá un monto entre 0.01 y Bs ${cuenta.montoAdeudado}.`);
      return;
    }
    if (!carteraId) {
      setError("Elegí la cartera en Bs donde se registra el cobro.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await cobrarCuenta(cuenta.id, { monto: valor, carteraId });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Cobrar ${cuenta.proforma.codigo}`} onClose={onClose}>
      <p className="cell-muted" style={{ marginBottom: 12 }}>
        Cliente: <strong>{cuenta.proforma.cliente?.nombre ?? "—"}</strong>. Saldo adeudado: <strong>Bs {cuenta.montoAdeudado}</strong>.
      </p>
      <div className="filter-field" style={{ marginBottom: 12 }}>
        <label className="filter-label">Monto a cobrar (Bs)</label>
        <input
          className="field"
          type="number"
          min={0.01}
          max={Number(cuenta.montoAdeudado)}
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
      </div>
      <div className="filter-field" style={{ marginBottom: 12 }}>
        <label className="filter-label">Cartera (Bs)</label>
        <CarteraSelector options={carterasBs} value={carteraId} onChange={setCarteraId} />
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="form-actions">
        <button type="button" className="link-button" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="button" onClick={confirmar} disabled={submitting}>
          {submitting ? "Guardando..." : "Confirmar"}
        </button>
      </div>
    </Modal>
  );
}
