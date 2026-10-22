import { notFound } from "next/navigation";
import { apiGetServer } from "../../../../lib/api-server";
import type { Empresa, Page, TipoProforma } from "../../../../lib/types";
import { NuevaProformaForm } from "../../../../components/proformas/NuevaProformaForm";

export default async function NuevaProformaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo: tipoParam } = await searchParams;
  if (tipoParam !== "venta" && tipoParam !== "compra") notFound();
  const tipo: TipoProforma = tipoParam === "venta" ? "VENTA" : "COMPRA";

  const empresasPage = await apiGetServer<Page<Empresa>>("/empresas?pageSize=100");
  const empresas = empresasPage.items.filter((e) => e.activo);

  return (
    <div className="card">
      <h1 style={{ margin: "0 0 4px", fontSize: 20 }}>
        Nueva proforma de {tipo === "VENTA" ? "venta" : "compra"}
      </h1>
      <p className="cell-muted" style={{ marginBottom: 20 }}>
        Completá lo mínimo para crearla. El resto (líneas, precios, envío) se arma en el siguiente paso.
      </p>
      <NuevaProformaForm tipo={tipo} empresas={empresas} />
    </div>
  );
}
