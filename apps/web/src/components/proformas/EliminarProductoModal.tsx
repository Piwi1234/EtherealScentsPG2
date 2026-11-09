"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, deleteProductoConAnuladas, getEliminacionProducto } from "../../lib/api";
import type { EliminacionProducto } from "../../lib/types";
import { Modal } from "../Modal";

/**
 * Elimina un producto desde la línea de una nota anulada de Registros. Primero revisa dónde se usa: si solo lo usan notas anuladas
 * (que conservan la línea pero ya no mueven stock ni plata) muestra de cuáles se va a quitar y deja confirmar; si tiene cualquier
 * otro uso, explica cuál y no deja eliminar.
 */
export function EliminarProductoModal({
  productoId,
  nombre,
  onClose,
  onDone,
}: {
  productoId: string;
  nombre: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [analisis, setAnalisis] = useState<EliminacionProducto | null>(null);
  const [error, setError] = useState("");
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    getEliminacionProducto(productoId)
      .then(setAnalisis)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)));
  }, [productoId]);

  async function eliminar() {
    setEliminando(true);
    setError("");
    try {
      await deleteProductoConAnuladas(productoId);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setEliminando(false);
    }
  }

  return (
    <Modal title="Eliminar producto" onClose={onClose} maxWidth={520}>
      {!analisis && !error && <p className="cell-muted">Revisando dónde se usa este producto…</p>}

      {analisis && analisis.puede && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0 }}>
            Vas a eliminar <strong>{nombre}</strong> del catálogo
            {analisis.variantes > 1 ? `, con sus ${analisis.variantes} variantes` : ""}. Esta acción no se puede deshacer.
          </p>
          {analisis.notasAnuladas.length > 0 && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 13 }} className="cell-muted">
                Solo lo usan notas anuladas. Se quitará de estas notas, que seguirán existiendo pero sin ese producto:
              </p>
              <ul className="stock-panel-list">
                {analisis.notasAnuladas.map((n) => (
                  <li key={n.id}>
                    <span>
                      <Link href={`/dashboard/proformas/${n.id}`} className="link-button">
                        {n.codigo}
                      </Link>
                      <span className="cell-muted"> · {n.tipo === "VENTA" ? "Venta" : "Compra"} anulada</span>
                    </span>
                    <strong>
                      {n.lineas} línea{n.lineas === 1 ? "" : "s"}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {analisis && !analisis.puede && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0 }}>
            No se puede eliminar <strong>{nombre}</strong> porque todavía se usa en otros lugares:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {analisis.bloqueos.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <button type="button" className="link-button" onClick={onClose}>
          {analisis && !analisis.puede ? "Cerrar" : "Cancelar"}
        </button>
        {analisis?.puede && (
          <button type="button" className="action-btn danger" onClick={eliminar} disabled={eliminando}>
            {eliminando ? "Eliminando..." : "Eliminar producto"}
          </button>
        )}
      </div>
    </Modal>
  );
}
