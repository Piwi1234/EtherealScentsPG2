"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, deleteCliente } from "../../lib/api";
import { getAuthUser } from "../../lib/auth";
import { Modal } from "../Modal";

export function ClienteAcciones({ clienteId, activo }: { clienteId: string; activo: boolean }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setIsAdmin(getAuthUser()?.rol === "ADMIN");
  }, []);

  async function handleDesactivar() {
    setSubmitting(true);
    setError("");
    try {
      await deleteCliente(clienteId);
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="row-actions" style={{ justifyContent: "flex-start" }}>
      <Link href={`/dashboard/clientes/${clienteId}/editar`} className="action-btn">
        Editar
      </Link>
      {activo ? (
        isAdmin && (
          <button type="button" className="action-btn danger" onClick={() => setConfirmOpen(true)}>
            Desactivar cliente
          </button>
        )
      ) : (
        <span className="cell-muted">Este cliente ya está inactivo.</span>
      )}

      {confirmOpen && (
        <Modal title="Desactivar cliente" onClose={() => setConfirmOpen(false)}>
          <p>
            ¿Seguro que querés desactivar este cliente? Va a dejar de aparecer como activo, pero su registro no se
            borra.
          </p>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="button" className="link-button" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="button" onClick={handleDesactivar} disabled={submitting}>
              {submitting ? "Desactivando..." : "Sí, desactivar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
