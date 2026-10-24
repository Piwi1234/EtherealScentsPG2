"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const LISTA_KEY = "proformas:ultima-lista";
const LISTA_BASE = "/dashboard/proformas";

/** Recuerda la URL de la lista de proformas con sus filtros/página, para poder volver exactamente ahí. */
export function guardarUltimaLista(href: string) {
  try {
    sessionStorage.setItem(LISTA_KEY, href);
  } catch {
    // sin sessionStorage (modo privado, etc.): el botón vuelve a la lista sin filtros
  }
}

export function VolverALista() {
  const [href, setHref] = useState(LISTA_BASE);

  useEffect(() => {
    try {
      const guardada = sessionStorage.getItem(LISTA_KEY);
      if (guardada?.startsWith(LISTA_BASE)) setHref(guardada);
    } catch {
      // se queda con la lista sin filtros
    }
  }, []);

  return (
    <Link href={href} className="link-button">
      Volver
    </Link>
  );
}
