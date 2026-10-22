"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createProforma } from "../../lib/api";
import type { Cliente, Empresa, TipoProforma } from "../../lib/types";
import { ClienteSelector, EmpresaSelector } from "./selectors";

/**
 * Único paso "todo en un formulario" del flujo: crea la proforma con lo mínimo indispensable
 * (`POST /proformas` exige clienteId en venta; en compra el proveedor se elige por línea al agregar
 * cada producto, no acá, y el almacén se elige más adelante, al completar) y navega al constructor
 * real, donde ya sí cada acción es su propio request.
 */
export function NuevaProformaForm({
  tipo,
  empresas,
  clientes,
}: {
  tipo: TipoProforma;
  empresas: Empresa[];
  clientes: Cliente[];
}) {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [clienteId, setClienteId] = useState("");
  const [ciudadEntregaId, setCiudadEntregaId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /** La ciudad de entrega no se pregunta acá: se toma en silencio de la ciudad del cliente elegido
   * (si la tiene definida). Queda editable después en la cabecera de la proforma ya creada. */
  function handleClienteChange(id: string) {
    setClienteId(id);
    const cliente = clientes.find((c) => c.id === id);
    setCiudadEntregaId(cliente?.ciudadId ?? "");
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
    setSubmitting(true);
    try {
      const proforma = await createProforma({
        tipo,
        empresaId,
        clienteId: tipo === "VENTA" ? clienteId : undefined,
        ciudadEntregaId: tipo === "VENTA" ? ciudadEntregaId || undefined : undefined,
      });
      router.push(`/dashboard/proformas/${proforma.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {/* Grid propia (no la de .form-grid, que es de una sola columna y la usan otros 17
          formularios del panel): acá sí conviene repartir los campos en el ancho disponible en vez
          de apilarlos, ya que la tarjeta ahora ocupa todo el ancho del panel. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
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
      </div>

      {tipo === "COMPRA" && (
        <p className="cell-muted" style={{ fontSize: 13, margin: 0 }}>
          El proveedor se elige por producto en el siguiente paso — una misma proforma puede traer
          productos de varios proveedores distintos.
        </p>
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
