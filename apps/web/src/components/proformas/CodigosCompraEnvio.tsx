import Link from "next/link";
import type { EstadoEnvio } from "../../lib/types";

/** Código de la compra en una etiqueta amarilla que lleva a la compra. */
export function CompraChip({ compra }: { compra: { id: string; codigo: string } | null | undefined }) {
  if (!compra) return <span className="cell-muted">—</span>;
  return (
    <Link href={`/dashboard/proformas/${compra.id}`} className="badge badge-warn" style={{ textDecoration: "none" }}>
      {compra.codigo}
    </Link>
  );
}

/** Códigos de los envíos en etiquetas azules que llevan a cada envío. */
export function EnviosChips({ envios }: { envios: { id: string; codigo: string }[] }) {
  if (envios.length === 0) return <span className="cell-muted">—</span>;
  return (
    <>
      {envios.map((e) => (
        <Link key={e.id} href={`/dashboard/stock/envios/${e.id}`} className="badge badge-info" style={{ textDecoration: "none" }}>
          {e.codigo}
        </Link>
      ))}
    </>
  );
}

/** Envíos distintos de una línea de compra, a partir de sus ítems de envío. */
export function enviosDeItems(envioItems?: { envio: { id: string; codigo: string; estado: EstadoEnvio } }[]): { id: string; codigo: string }[] {
  return Array.from(new Map((envioItems ?? []).map((i) => [i.envio.id, { id: i.envio.id, codigo: i.envio.codigo }])).values());
}

/** Código de la nota (o solicitud) en una etiqueta negra que lleva al documento. */
export function NotaChip({ href, codigo }: { href: string; codigo: string }) {
  return (
    <Link href={href} className="badge" style={{ textDecoration: "none", background: "#1a1a1a", borderColor: "#1a1a1a", color: "#ffffff", fontWeight: 600 }}>
      {codigo}
    </Link>
  );
}
