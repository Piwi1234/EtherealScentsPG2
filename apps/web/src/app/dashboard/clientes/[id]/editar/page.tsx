import { notFound } from "next/navigation";
import { apiGetServer } from "../../../../../lib/api-server";
import { ApiError } from "../../../../../lib/api";
import type { Cliente } from "../../../../../lib/types";
import { ClienteForm } from "../../../../../components/clientes/ClienteForm";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let cliente: Cliente;
  try {
    cliente = await apiGetServer<Cliente>(`/clientes/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 20 }}>Editar cliente</h1>
      <ClienteForm mode="editar" cliente={cliente} />
    </div>
  );
}
