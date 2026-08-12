"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, updateProforma } from "../../lib/api";
import type { Ciudad, Cliente, Empresa, Proforma } from "../../lib/types";
import { CiudadSelector, ClienteSelector, EmpresaSelector } from "./selectors";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="filter-label">{label}</span>
      <p style={{ margin: "4px 0 0" }}>{value}</p>
    </div>
  );
}

/**
 * Cabecera de la proforma. Mientras está en BORRADOR es editable inline (empresa, cliente, ciudad de
 * entrega) — un único botón "Guardar cambios" que dispara un solo PATCH /proformas/:id con todo. El
 * almacén ya no se toca acá para ningún tipo: para VENTA se fija al aprobar, para COMPRA al completar
 * — se muestra de solo lectura (`proforma.almacen`) una vez que existe. Fuera de BORRADOR se muestra
 * todo de solo lectura. El descuento general y el adelanto viven en `ProformaTotales`, junto al total
 * que generan las líneas — no acá.
 */
export function ProformaHeaderEditor({
  proforma,
  editable,
  empresas,
  clientes,
  ciudades,
}: {
  proforma: Proforma;
  editable: boolean;
  empresas: Empresa[];
  clientes: Cliente[];
  ciudades: Ciudad[];
}) {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState(proforma.empresaId);
  const [clienteId, setClienteId] = useState(proforma.clienteId ?? "");
  const [ciudadEntregaId, setCiudadEntregaId] = useState(proforma.ciudadEntregaId ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /** Al elegir cliente, precarga la ciudad de entrega con la del cliente (si tiene una definida en
   * su catálogo) — sigue quedando editable después vía el selector de abajo. */
  function handleClienteChange(id: string) {
    setClienteId(id);
    const cliente = clientes.find((c) => c.id === id);
    if (cliente?.ciudadId) {
      setCiudadEntregaId(cliente.ciudadId);
    }
  }

  async function handleSave() {
    setError("");
    setSubmitting(true);
    try {
      await updateProforma(proforma.id, {
        empresaId,
        clienteId: proforma.tipo === "VENTA" ? clienteId || undefined : undefined,
        ciudadEntregaId: proforma.tipo === "VENTA" ? ciudadEntregaId || undefined : undefined,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!editable) {
    return (
      <div className="grid-2" style={{ marginBottom: 24, rowGap: 18 }}>
        <Field label="Empresa" value={proforma.empresa.nombre} />
        {proforma.tipo === "VENTA" ? (
          <Field label="Cliente" value={proforma.cliente?.nombre ?? "—"} />
        ) : (
          <Field label="Almacén" value={proforma.almacen?.nombre ?? "— (se elige al completar) —"} />
        )}
        {proforma.tipo === "VENTA" && <Field label="Ciudad de entrega" value={proforma.ciudadEntrega?.nombre ?? "—"} />}
        {proforma.tipo === "VENTA" && <Field label="Vendedor" value={proforma.creadoPor.nombre} />}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="filters-bar">
        <div className="filter-field" style={{ minWidth: 200 }}>
          <label className="filter-label">Empresa</label>
          <EmpresaSelector options={empresas} value={empresaId} onChange={setEmpresaId} />
        </div>
        {proforma.tipo === "VENTA" && (
          <div className="filter-field" style={{ minWidth: 200 }}>
            <label className="filter-label">Cliente</label>
            <ClienteSelector options={clientes} value={clienteId} onChange={handleClienteChange} />
          </div>
        )}
        {proforma.tipo === "VENTA" && (
          <div className="filter-field" style={{ minWidth: 180 }}>
            <label className="filter-label">Ciudad de entrega</label>
            <CiudadSelector options={ciudades} value={ciudadEntregaId} onChange={setCiudadEntregaId} placeholder="— Sin definir —" />
          </div>
        )}
        {proforma.tipo === "VENTA" && (
          <div className="filter-field" style={{ minWidth: 160 }}>
            <label className="filter-label">Vendedor</label>
            <p style={{ margin: "9px 0 0" }}>{proforma.creadoPor.nombre}</p>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button type="button" className="action-btn" onClick={handleSave} disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
      {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
