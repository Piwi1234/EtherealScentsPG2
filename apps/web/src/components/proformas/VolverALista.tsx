"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const LISTA_BASE = "/dashboard/registros";

/** Vuelve a Registros, en la pestaña (Ventas / Compras / Sin concretar) que se estaba mirando. */
export function VolverALista() {
  const [href, setHref] = useState(LISTA_BASE);

  useEffect(() => {
    try {
      const tab = sessionStorage.getItem("registros:tab");
      if (tab) setHref(`${LISTA_BASE}?tab=${tab}`);
    } catch {
      // se queda en Registros sin pestaña
    }
  }, []);

  return (
    <Link href={href} className="link-button">
      Volver
    </Link>
  );
}
