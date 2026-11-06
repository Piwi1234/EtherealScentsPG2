"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, cobrarCuenta, downloadEstadoCuenta, getCarteras, getCuentasPorCobrarPorCliente } from "../../../../lib/api";
import type { Cartera, CuentaPorCobrarConProforma, CuentaPorCobrarGrupo, EstadoCuentaPorCobrar, Page } from "../../../../lib/types";
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

export default function CuentasPorCobrarPage() {
  const [estado, setEstado] = useState<"" | EstadoCuentaPorCobrar>("PENDIENTE");
  const [clienteId, setClienteId] = useState("");
  const [codigoInput, setCodigoInput] = useState("");
  const [codigo, setCodigo] = useState("");
  const [dateSelection, setDateSelection] = useState<DateSelection>(TODO_EL_TIEMPO);
  const [pageNum, setPageNum] = useState(1);
  const [data, setData] = useState<Page<CuentaPorCobrarGrupo> | null>(null);
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

  // Un cliente con una sola deuda se ve como una fila normal; con 2 o más es un grupo desplegable.
  const desplegables = data ? data.items.filter((g) => g.clienteId && g.cantidad > 1).map((g) => g.clienteId as string) : [];
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

  function filaCuenta(cuenta: CuentaPorCobrarConProforma, opciones: { sinCliente?: boolean; extra?: React.ReactNode }) {
    return (
      <tr key={cuenta.id}>
        <td className={opciones.sinCliente ? "reg-indent cell-muted" : "cell-muted"}>{formatDate(cuenta.proforma.fecha)}</td>
        <td>
          <Link href={`/dashboard/proformas/${cuenta.proforma.id}`} className="link-button">
            {cuenta.proforma.codigo}
          </Link>
        </td>
        <td className="cell-muted">{opciones.sinCliente ? "" : (cuenta.proforma.cliente?.nombre ?? "—")}</td>
        <td>
          <EstadoBadge estado={cuenta.proforma.estado} />
        </td>
        <td className="num cell-muted">Bs {Number(cuenta.montoTotal).toFixed(2)}</td>
        <td className="num cell-muted">Bs {(Number(cuenta.montoTotal) - Number(cuenta.montoAdeudado)).toFixed(2)}</td>
        <td className="num cell-primary">Bs {Number(cuenta.montoAdeudado).toFixed(2)}</td>
        <td>
          <EstadoCuentaBadge estado={cuenta.estado} />
        </td>
        <td>
          {cuenta.estado === "PENDIENTE" && (
            <button type="button" className="action-btn" onClick={() => setCobrando(cuenta)}>
              Cobrar
            </button>
          )}
          {opciones.extra}
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Cuentas por Cobrar</h1>
      </div>

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
          <table className="table table-minimal table-compact">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>N° proforma</th>
                <th>Cliente</th>
                <th>Proforma</th>
                <th className="num">Total</th>
                <th className="num">Cobrado</th>
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
                    style={{ marginLeft: 6 }}
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
                // Una sola deuda (o sin cliente): fila normal, como siempre.
                if (!grupo.clienteId || grupo.cantidad === 1) {
                  return filaCuenta(grupo.cuentas[0], { extra: grupo.clienteId && tieneSaldo ? botonPdf : null });
                }
                const abierto = abiertos.has(grupo.clienteId);
                return (
                  <Fragment key={grupo.clienteId}>
                    <tr className="reg-group" onClick={() => alternar(grupo.clienteId as string)} aria-expanded={abierto}>
                      <td colSpan={3} className="reg-group-code">
                        <span className="reg-chevron">{abierto ? "▾" : "▸"}</span>
                        <span className="cell-primary">{grupo.cliente?.nombre ?? "—"}</span>
                      </td>
                      <td className="cell-muted" style={{ fontWeight: 400 }}>
                        {grupo.cantidad} deudas
                      </td>
                      <td className="num cell-muted">Bs {Number(grupo.montoTotal).toFixed(2)}</td>
                      <td className="num cell-muted">Bs {Number(grupo.montoCobrado).toFixed(2)}</td>
                      <td className="num cell-primary">Bs {Number(grupo.montoAdeudado).toFixed(2)}</td>
                      <td></td>
                      <td>{tieneSaldo && botonPdf}</td>
                    </tr>
                    {abierto && grupo.cuentas.map((cuenta) => filaCuenta(cuenta, { sinCliente: true }))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
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
