import Link from "next/link";
import type { EstadoEnvio } from "../../lib/types";

/** Envíos (ya despachados) en los que viaja una línea de compra, como enlaces. */
export function EnviosDeLinea({ envioItems }: { envioItems?: { cantidad: number; envio: { id: string; codigo: string; estado: EstadoEnvio } }[] }) {
  const envios = Array.from(new Map((envioItems ?? []).map((i) => [i.envio.id, i.envio])).values());
  if (envios.length === 0) return null;
  return (
    <div style={{ fontSize: 12 }}>
      {envios.length === 1 ? "Envío " : "Envíos "}
      {envios.map((e, i) => (
        <span key={e.id}>
          {i > 0 && ", "}
          <Link href={`/dashboard/stock/envios/${e.id}`} className="link-button">
            {e.codigo}
          </Link>
        </span>
      ))}
    </div>
  );
}
