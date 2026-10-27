"use client";

import { useState } from "react";
import { ApiError, downloadSeguimientoExcel } from "../../lib/api";

/**
 * Descarga a Excel la lista de Seguimiento tal como está filtrada en pantalla (estado, cliente, producto o marca,
 * categoría y empresa), con todas las filas, no solo las de la página actual.
 */
export function SeguimientoExportarBoton({
  vista,
  filtros,
}: {
  vista: "pedidos" | "solicitudes" | "stock";
  filtros: { estado?: string; categoryId?: string; empresaId?: string; clienteId?: string; search?: string };
}) {
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");

  async function exportar() {
    setExportando(true);
    setError("");
    try {
      await downloadSeguimientoExcel(vista, filtros);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setExportando(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {error && <span className="error-text" style={{ fontSize: 12 }}>{error}</span>}
      <button
        type="button"
        className="button"
        onClick={exportar}
        disabled={exportando}
        style={{ background: "#14805F", borderColor: "#14805F", color: "#ffffff" }}
      >
        {exportando ? "Exportando..." : "Exportar a Excel"}
      </button>
    </div>
  );
}
