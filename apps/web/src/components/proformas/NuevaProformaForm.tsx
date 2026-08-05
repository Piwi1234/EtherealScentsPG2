"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createProforma } from "../../lib/api";
import type { Almacen, Cliente, Empresa, TipoProforma } from "../../lib/types";
import { AlmacenSelector, ClienteSelector, EmpresaSelector } from "./selectors";

/**
 * Único paso "todo en un formulario" del flujo: crea la proforma con lo mínimo indispensable
 * (`POST /proformas` exige clienteId en venta y almacenRecepcionId en compra) y navega al
 * constructor real, donde ya sí cada acción es su propio request.
 */
export function NuevaProformaForm({
  tipo,
  empresas,
  clientes,
  almacenes,
}: {
  tipo: TipoProforma;
  empresas: Empresa[];
  clientes: Cliente[];
  almacenes: Almacen[];
}) {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [clienteId, setClienteId] = useState("");
  const [almacenRecepcionId, setAlmacenRecepcionId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    if (tipo === "COMPRA" && !almacenRecepcionId) {
      setError("Elegí el almacén que recibe la mercadería.");
      return;
    }
    setSubmitting(true);
    try {
      const proforma = await createProforma({
        tipo,
        empresaId,
        clienteId: tipo === "VENTA" ? clienteId : undefined,
        almacenRecepcionId: tipo === "COMPRA" ? almacenRecepcionId : undefined,
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

      {tipo === "VENTA" ? (
        <div>
          <label>Cliente</label>
          <ClienteSelector options={clientes} value={clienteId} onChange={setClienteId} />
        </div>
      ) : (
        <div>
          <label>Almacén de recepción</label>
          <AlmacenSelector options={almacenes} value={almacenRecepcionId} onChange={setAlmacenRecepcionId} />
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
