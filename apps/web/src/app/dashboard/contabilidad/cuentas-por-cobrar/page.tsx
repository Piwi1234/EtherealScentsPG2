"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, cobrarCuenta, getCarteras, getClientes, getCuentasPorCobrar } from "../../../../lib/api";
import type { Cartera, Cliente, CuentaPorCobrarConProforma, EstadoCuentaPorCobrar, Page } from "../../../../lib/types";
import { Modal } from "../../../../components/Modal";
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
  const [data, setData] = useState<Page<CuentaPorCobrarConProforma> | null>(null);
  const [carterasBs, setCarterasBs] = useState<Cartera[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cobrando, setCobrando] = useState<CuentaPorCobrarConProforma | null>(null);

  function load() {
    setLoading(true);
    getCuentasPorCobrar({
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
    getClientes({ activo: "true", limit: 500 })
      .then((page) => setClientes(page.items))
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
          <ClienteSearchSelect clientes={clientes} value={clienteId} onChange={handleClienteChange} />
        </div>
        <DateRangeDropdown onApply={handleDateApply} />
      </div>

      {loading ? (
        <p className="cell-muted">Cargando...</p>
      ) : !data || data.items.length === 0 ? (
        <p>No hay cuentas por cobrar para estos filtros.</p>
      ) : (
        <>
          <table className="table table-minimal">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>N° proforma</th>
                <th>Cliente</th>
                <th className="num">Monto</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((cuenta) => (
                <tr key={cuenta.id}>
                  <td className="cell-muted">{formatDate(cuenta.proforma.fecha)}</td>
                  <td>
                    <Link href={`/dashboard/proformas/${cuenta.proforma.id}`} className="link-button">
                      {cuenta.proforma.codigo}
                    </Link>
                  </td>
                  <td className="cell-muted">{cuenta.proforma.cliente?.nombre ?? "—"}</td>
                  <td className="num cell-primary">Bs {cuenta.montoAdeudado}</td>
                  <td>
                    <EstadoCuentaBadge estado={cuenta.estado} />
                  </td>
                  <td>
                    {cuenta.estado === "PENDIENTE" && (
                      <button type="button" className="action-btn" onClick={() => setCobrando(cuenta)}>
                        Cobrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
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
