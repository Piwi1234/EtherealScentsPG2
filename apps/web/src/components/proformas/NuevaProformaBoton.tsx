"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createProforma } from "../../lib/api";
import type { TipoProforma } from "../../lib/types";

/**
 * Crea la proforma en BORRADOR al instante, con la casa matriz como empresa (editable después en la
 * cabecera) y sin cliente en las ventas: el cliente se elige directo en el buscador de la cabecera y
 * es obligatorio recién al aprobar. Va directo al constructor, sin pantalla intermedia.
 */
export function NuevaProformaBoton({
  tipo,
  empresaId,
  variante,
}: {
  tipo: TipoProforma;
  empresaId: string;
  /** "primario" / "secundario": el par de botones del dashboard (ver .btn-new en globals.css). Sin valor, el botón clásico del listado. */
  variante?: "primario" | "secundario";
}) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (!empresaId) {
      setError("No hay una empresa activa para crear la proforma.");
      return;
    }
    setError("");
    setCreando(true);
    try {
      const proforma = await createProforma({ tipo, empresaId });
      router.push(`/dashboard/proformas/${proforma.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setCreando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={variante ? `btn-new btn-new--${variante}` : "btn-cta"}
        onClick={handleClick}
        disabled={creando}
      >
        <span className={variante ? "btn-new-icon" : "btn-cta-icon"}>+</span>{" "}
        {creando ? "Creando..." : tipo === "VENTA" ? "Nueva venta" : "Nueva compra"}
      </button>
      {error && <span className="error-text">{error}</span>}
    </>
  );
}
