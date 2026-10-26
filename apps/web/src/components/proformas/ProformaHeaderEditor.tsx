"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, cambiarAlmacenCompra, updateProforma } from "../../lib/api";
import type { Almacen, Ciudad, Cliente, Empresa, Proforma, Proveedor } from "../../lib/types";
import { ClienteBuscador } from "./ClienteBuscador";
import { AlmacenSelector, CiudadSelector, EmpresaSelector, ProveedorSelector } from "./selectors";

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
 * entrega, y en COMPRA el tipo de cambio propio de la compra) — un único botón "Guardar cambios" que
 * dispara un solo PATCH /proformas/:id con todo. El proveedor ya no es de la cabecera: es por línea
 * (ver ProformaDetalleTable), una misma compra puede traer productos de varios proveedores. El
 * almacén ya no se toca acá para ningún tipo: para VENTA se fija al aprobar, para COMPRA al
 * completar — se muestra de solo lectura (`proforma.almacen`) una vez que existe. Fuera de BORRADOR
 * se muestra todo de solo lectura. El descuento general y el adelanto viven en `ProformaTotales`,
 * junto al total que generan las líneas — no acá.
 */
export function ProformaHeaderEditor({
  proforma,
  editable,
  empresas,
  ciudades,
  proveedores = [],
  almacenes = [],
}: {
  proforma: Proforma;
  editable: boolean;
  empresas: Empresa[];
  ciudades: Ciudad[];
  proveedores?: Proveedor[];
  almacenes?: Almacen[];
}) {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState(proforma.empresaId);
  const [clienteId, setClienteId] = useState(proforma.clienteId ?? "");
  const [ciudadEntregaId, setCiudadEntregaId] = useState(proforma.ciudadEntregaId ?? "");
  const [proveedorId, setProveedorId] = useState(proforma.proveedorId ?? "");
  const [tipoCambioProf, setTipoCambioProf] = useState(proforma.tipoCambioProf ?? "");
  const [almacenId, setAlmacenId] = useState(proforma.almacenId ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /** El almacén destino de una compra se guarda solo al elegirlo; aprobada, se cambia con su propio endpoint. */
  async function handleAlmacenChange(id: string) {
    setAlmacenId(id);
    if (!id) return;
    setError("");
    try {
      if (proforma.estado === "APROBADA") await cambiarAlmacenCompra(proforma.id, id);
      else await updateProforma(proforma.id, { almacenId: id });
      router.refresh();
    } catch (e) {
      setAlmacenId(proforma.almacenId ?? "");
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  /** Al elegir cliente se guarda solo (junto con la ciudad de entrega del cliente, si tiene una
   * definida en su catálogo — sigue editable después vía el selector de abajo). */
  async function handleClienteChange(cliente: Cliente | null) {
    setClienteId(cliente?.id ?? "");
    const ciudad = cliente?.ciudadId ?? ciudadEntregaId;
    if (cliente?.ciudadId) setCiudadEntregaId(cliente.ciudadId);
    if (!cliente) return;
    setError("");
    try {
      await updateProforma(proforma.id, { clienteId: cliente.id, ciudadEntregaId: ciudad || undefined });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  /** El proveedor de la nota se guarda solo al elegirlo y todas las líneas lo heredan. */
  async function handleProveedorChange(id: string) {
    setProveedorId(id);
    if (!id) return;
    setError("");
    try {
      await updateProforma(proforma.id, { proveedorId: id });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
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
        tipoCambioProf: proforma.tipo === "COMPRA" && tipoCambioProf !== "" ? Number(tipoCambioProf) : undefined,
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
          <Field label="Proveedor" value={proforma.proveedor?.nombre ?? "Varios"} />
        )}
        {proforma.tipo === "COMPRA" && proforma.estado === "APROBADA" && almacenes.length > 0 ? (
          <div>
            <span className="filter-label">Almacén destino</span>
            <AlmacenSelector options={almacenes} value={almacenId} onChange={handleAlmacenChange} />
            {error && <p className="error-text" style={{ marginTop: 6 }}>{error}</p>}
          </div>
        ) : (
          proforma.tipo === "COMPRA" && <Field label="Almacén destino" value={proforma.almacen?.nombre ?? "—"} />
        )}
        {proforma.tipo === "VENTA" && <Field label="Ciudad de entrega" value={proforma.ciudadEntrega?.nombre ?? "—"} />}
        {proforma.tipo === "VENTA" && <Field label="Vendedor" value={proforma.creadoPor.nombre} />}
        {proforma.tipo === "COMPRA" && (
          <Field label="Tipo de Cambio Prof" value={proforma.tipoCambioProf ? `Bs ${proforma.tipoCambioProf}` : "—"} />
        )}
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
            <ClienteBuscador value={clienteId} initialNombre={proforma.cliente?.nombre} onChange={handleClienteChange} />
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
        {proforma.tipo === "COMPRA" && (
          <div className="filter-field" style={{ minWidth: 220 }}>
            <label className="filter-label">Proveedor</label>
            <ProveedorSelector options={proveedores} value={proveedorId} onChange={handleProveedorChange} />
          </div>
        )}
        {proforma.tipo === "COMPRA" && (
          <div className="filter-field" style={{ minWidth: 200 }}>
            <label className="filter-label">Almacén destino</label>
            <AlmacenSelector options={almacenes} value={almacenId} onChange={handleAlmacenChange} />
          </div>
        )}
        {proforma.tipo === "COMPRA" && (
          <div className="filter-field" style={{ minWidth: 140 }}>
            <label className="filter-label">Tipo de Cambio Prof</label>
            <input
              className="field"
              type="number"
              min="0"
              step="0.0001"
              value={tipoCambioProf}
              onChange={(e) => setTipoCambioProf(e.target.value)}
            />
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
