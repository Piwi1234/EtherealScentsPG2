"use client";

import { useEffect } from "react";
import type { Almacen, Cartera, Ciudad, Empresa, Proveedor } from "../../lib/types";

/** Selects reutilizables — reciben las opciones ya cargadas por el Server Component padre, no
 * fetchean solos (evita un waterfall de requests client-side). */

type SelectorProps<T> = {
  options: T[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function EmpresaSelector({ options, value, onChange, placeholder = "— Elegir empresa —", disabled }: SelectorProps<Empresa>) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre} ({o.tipo === "CASA_MATRIZ" ? "Casa matriz" : "Sucursal"})
        </option>
      ))}
    </select>
  );
}

export function ProveedorSelector({
  options,
  value,
  onChange,
  placeholder = "— Elegir proveedor —",
  disabled,
}: SelectorProps<Proveedor>) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre} {o.paisProcedencia ? `— ${o.paisProcedencia.nombre}` : ""}
        </option>
      ))}
    </select>
  );
}

export function AlmacenSelector({ options, value, onChange, placeholder = "— Elegir almacén —", disabled }: SelectorProps<Almacen>) {
  // Al aparecer sin valor, preselecciona el almacén predeterminado (si hay uno activo entre las opciones).
  useEffect(() => {
    if (value) return;
    const predeterminado = options.find((o) => o.predeterminado && o.activo);
    if (predeterminado) onChange(predeterminado.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre}
        </option>
      ))}
    </select>
  );
}

export function CiudadSelector({ options, value, onChange, placeholder = "— Elegir ciudad —", disabled }: SelectorProps<Ciudad>) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre}
        </option>
      ))}
    </select>
  );
}

export function CarteraSelector({ options, value, onChange, placeholder = "— Elegir cartera —", disabled }: SelectorProps<Cartera>) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre}
        </option>
      ))}
    </select>
  );
}
