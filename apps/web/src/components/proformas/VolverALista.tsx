"use client";

import Link from "next/link";

/** Vuelve a Registros: la pestaña, los filtros y la página que había antes de abrir la proforma se restauran solos. */
export function VolverALista() {
  return (
    <Link href="/dashboard/registros" className="link-button">
      Volver
    </Link>
  );
}
