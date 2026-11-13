"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCombos } from "../../lib/api";
import type { Combo, TipoProforma } from "../../lib/types";
import { AgregarComboPanel } from "./AgregarComboPanel";
import { AgregarProductoBrowser } from "./AgregarProductoBrowser";

type Pestana = "productos" | "combos";

/**
 * Agregar producto a una venta: dos pestañas, «Productos» (buscar y agregar uno por uno) y «Combos» (con el descuento ya repartido), para que
 * los combos no queden apilados antes de la tabla. Ambas pestañas se mantienen montadas: al cambiar de una a otra no se pierden los filtros
 * ni los resultados. La franja de arriba muestra cuántas líneas lleva la nota y su total, y se actualiza tras cada producto o combo agregado.
 */
export function AgregarVentaTabs({
  proformaId,
  tipo,
  cantidadesIniciales,
  lineas,
  total,
}: {
  proformaId: string;
  tipo: TipoProforma;
  cantidadesIniciales: Record<string, number>;
  lineas: number;
  total: number;
}) {
  const router = useRouter();
  const [pestana, setPestana] = useState<Pestana>("productos");
  const [combos, setCombos] = useState<Combo[] | null>(null);

  useEffect(() => {
    getCombos()
      .then(setCombos)
      .catch(() => setCombos([]));
  }, []);

  const hayCombos = (combos?.length ?? 0) > 0;
  // Sin combos creados no hay nada que elegir: se muestra solo la tabla, como antes.
  const activa: Pestana = hayCombos ? pestana : "productos";

  return (
    <div>
      <div className="av-resumen">
        <span>
          <span className="cell-muted">En la nota</span> <strong>{lineas} línea{lineas === 1 ? "" : "s"}</strong>
          <span className="cell-muted"> · </span>
          <strong>Bs {total.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </span>
      </div>

      {hayCombos && (
        <div className="dg-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={activa === "productos"} className={`dg-tab${activa === "productos" ? " dg-tab--on" : ""}`} onClick={() => setPestana("productos")}>
            <span>Productos</span>
            <small>Buscar y agregar uno por uno</small>
          </button>
          <button type="button" role="tab" aria-selected={activa === "combos"} className={`dg-tab${activa === "combos" ? " dg-tab--on" : ""}`} onClick={() => setPestana("combos")}>
            <span>
              Combos <b className="av-contador">{combos?.length}</b>
            </span>
            <small>Con el descuento ya repartido</small>
          </button>
        </div>
      )}

      <div hidden={activa !== "productos"}>
        <AgregarProductoBrowser proformaId={proformaId} tipo={tipo} cantidadesIniciales={cantidadesIniciales} onAgregado={() => router.refresh()} />
      </div>
      {hayCombos && (
        <div hidden={activa !== "combos"}>
          <AgregarComboPanel proformaId={proformaId} combos={combos ?? []} onAgregado={() => router.refresh()} />
        </div>
      )}
    </div>
  );
}
