import { ClienteForm } from "../../../../components/clientes/ClienteForm";

export default function NuevoClientePage() {
  return (
    <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 20 }}>Nuevo cliente</h1>
      <ClienteForm mode="crear" />
    </div>
  );
}
