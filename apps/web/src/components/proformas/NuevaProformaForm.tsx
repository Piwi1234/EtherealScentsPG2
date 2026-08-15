"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createProforma } from "../../lib/api";
import type { Cliente, Empresa, Proveedor, TipoProforma } from "../../lib/types";
import { ClienteSelector, EmpresaSelector, ProveedorSelector } from "./selectors";

/**
 * Único paso "todo en un formulario" del flujo: crea la proforma con lo mínimo indispensable
 * (`POST /proformas` exige clienteId en venta, proveedorId en compra; en compra el almacén se elige
 * más adelante, al completar) y navega al constructor real, donde ya sí cada acción es su propio
 * request.
 */
export function NuevaProformaForm({
  tipo,
  empresas,
  clientes,
  proveedores,
}: {
  tipo: TipoProforma;
  empresas: Empresa[];
  clientes: Cliente[];
  proveedores: Proveedor[];
}) {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [clienteId, setClienteId] = useState("");
  const [ciudadEntregaId, setCiudadEntregaId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [paisProcedenciaId, setPaisProcedenciaId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /** La ciudad de entrega no se pregunta acá: se toma en silencio de la ciudad del cliente elegido
   * (si la tiene definida). Queda editable después en la cabecera de la proforma ya creada. */
  function handleClienteChange(id: string) {
    setClienteId(id);
    const cliente = clientes.find((c) => c.id === id);
    setCiudadEntregaId(cliente?.ciudadId ?? "");
  }

  /** Mismo criterio que la ciudad de entrega en VENTA: el país de procedencia no se pregunta acá,
   * se precarga en silencio con el del proveedor elegido y queda editable después. */
  function handleProveedorChange(id: string) {
    setProveedorId(id);
    const proveedor = proveedores.find((p) => p.id === id);
    setPaisProcedenciaId(proveedor?.paisProcedenciaId ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!empresaId) {
      setError("Elegí una empresa.");
      return;
    }
    if (tipo === "VENTA" && !clienteId) {
      setError("Elegí un cliente.");
      return;
    }
    if (tipo === "COMPRA" && !proveedorId) {
      setError("Elegí un proveedor.");
      return;
    }
    setSubmitting(true);
    try {
      const proforma = await createProforma({
        tipo,
        empresaId,
        clienteId: tipo === "VENTA" ? clienteId : undefined,
        ciudadEntregaId: tipo === "VENTA" ? ciudadEntregaId || undefined : undefined,
        proveedorId: tipo === "COMPRA" ? proveedorId : undefined,
        paisProcedenciaId: tipo === "COMPRA" ? paisProcedenciaId || undefined : undefined,
      });
      router.push(`/dashboard/proformas/${proforma.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div>
        <label>Empresa</label>
        <EmpresaSelector options={empresas} value={empresaId} onChange={setEmpresaId} />
      </div>

      {tipo === "VENTA" && (
        <div>
          <label>Cliente</label>
          <ClienteSelector options={clientes} value={clienteId} onChange={handleClienteChange} />
        </div>
      )}

      {tipo === "COMPRA" && (
        <div>
          <label>Proveedor</label>
          <ProveedorSelector options={proveedores} value={proveedorId} onChange={handleProveedorChange} />
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? "Creando..." : "Crear y continuar"}
        </button>
      </div>
    </form>
  );
}
