import { redirect } from "next/navigation";

/** La lista de proformas se unificó con Registros: las direcciones viejas (con ?tipo=, ?estado=, ?entrega=) redirigen allá. */
export default async function ProformasPage({ searchParams }: { searchParams: Promise<{ tipo?: string; estado?: string; entrega?: string }> }) {
  const { tipo, estado, entrega } = await searchParams;
  const qs = new URLSearchParams();
  const sinConcretar = estado === "BORRADOR" || estado === "ANULADA";
  qs.set("tab", sinConcretar ? "SIN_CONCRETAR" : tipo === "COMPRA" ? "COMPRA" : "VENTA");
  if (estado && !(sinConcretar && false)) qs.set("estado", estado);
  if (entrega) qs.set("entrega", entrega);
  redirect(`/dashboard/registros?${qs.toString()}`);
}
