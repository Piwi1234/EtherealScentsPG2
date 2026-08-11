import type { Almacen, Ciudad, Cliente, Empresa } from "../../lib/types";

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

export function ClienteSelector({ options, value, onChange, placeholder = "— Elegir cliente —", disabled }: SelectorProps<Cliente>) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre} — {o.numeroDocumento}
        </option>
      ))}
    </select>
  );
}

export function AlmacenSelector({ options, value, onChange, placeholder = "— Elegir almacén —", disabled }: SelectorProps<Almacen>) {
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
