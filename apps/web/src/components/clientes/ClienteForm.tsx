"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createCliente, getCiudades, updateCliente } from "../../lib/api";
import type { Ciudad, Cliente, TipoCliente, TipoDocumento } from "../../lib/types";
import { CiudadSelector } from "../proformas/selectors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "crear" | "editar";

type FormValues = {
  tipo: TipoCliente;
  nombre: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  ciudadId: string;
};

function initialValuesFrom(cliente?: Cliente): FormValues {
  return {
    tipo: cliente?.tipo ?? "NATURAL",
    nombre: cliente?.nombre ?? "",
    tipoDocumento: cliente?.tipoDocumento ?? "CI",
    numeroDocumento: cliente?.numeroDocumento ?? "",
    email: cliente?.email ?? "",
    telefono: cliente?.telefono ?? "",
    direccion: cliente?.direccion ?? "",
    ciudad: cliente?.ciudad ?? "",
    ciudadId: cliente?.ciudadId ?? "",
  };
}

export function ClienteForm({ mode, cliente }: { mode: Mode; cliente?: Cliente }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => initialValuesFrom(cliente));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);

  useEffect(() => {
    getCiudades({ pageSize: 100 })
      .then((page) => setCiudades(page.items))
      .catch(() => {});
  }, []);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!values.nombre.trim()) errors.nombre = "Este campo es requerido.";
    if (!values.numeroDocumento.trim()) errors.numeroDocumento = "El número de documento es requerido.";
    if (values.email.trim() && !EMAIL_RE.test(values.email.trim())) {
      errors.email = "El email no tiene un formato válido.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        tipo: values.tipo,
        nombre: values.nombre.trim(),
        tipoDocumento: values.tipoDocumento,
        numeroDocumento: values.numeroDocumento.trim(),
        email: values.email.trim() || undefined,
        telefono: values.telefono.trim() || undefined,
        direccion: values.direccion.trim() || undefined,
        ciudad: values.ciudad.trim() || undefined,
        ciudadId: values.ciudadId || undefined,
      };
      const result = mode === "crear" ? await createCliente(payload) : await updateCliente(cliente!.id, payload);
      router.push(`/dashboard/clientes/${result.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const lower = err.message.toLowerCase();
        if (lower.includes("documento")) {
          setFieldErrors((prev) => ({ ...prev, numeroDocumento: err.message }));
        } else if (lower.includes("email")) {
          setFieldErrors((prev) => ({ ...prev, email: err.message }));
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const nombreLabel = values.tipo === "JURIDICA" ? "Razón social" : "Nombre";

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div>
        <label>Tipo de cliente</label>
        <div className="pill-group">
          {(["NATURAL", "JURIDICA"] as TipoCliente[]).map((tipo) => (
            <label key={tipo} className="checkbox-row" style={{ cursor: "pointer" }}>
              <input type="radio" name="tipo" checked={values.tipo === tipo} onChange={() => setField("tipo", tipo)} />
              {tipo === "NATURAL" ? "Natural" : "Jurídica"}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label>{nombreLabel}</label>
        <input className="field" value={values.nombre} onChange={(e) => setField("nombre", e.target.value)} />
        {fieldErrors.nombre && <p className="error-text">{fieldErrors.nombre}</p>}
      </div>

      <div className="grid-2">
        <div>
          <label>Tipo de documento</label>
          <select
            className="field"
            value={values.tipoDocumento}
            onChange={(e) => setField("tipoDocumento", e.target.value as TipoDocumento)}
          >
            <option value="DNI">DNI</option>
            <option value="CI">CI</option>
            <option value="RUC">RUC</option>
            <option value="PASAPORTE">Pasaporte</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div>
          <label>Número de documento</label>
          <input
            className="field"
            value={values.numeroDocumento}
            onChange={(e) => setField("numeroDocumento", e.target.value)}
          />
          {fieldErrors.numeroDocumento && <p className="error-text">{fieldErrors.numeroDocumento}</p>}
        </div>
      </div>

      <div>
        <label>Email</label>
        <input className="field" type="email" value={values.email} onChange={(e) => setField("email", e.target.value)} />
        {fieldErrors.email && <p className="error-text">{fieldErrors.email}</p>}
      </div>

      <div className="grid-2">
        <div>
          <label>Teléfono</label>
          <input className="field" value={values.telefono} onChange={(e) => setField("telefono", e.target.value)} />
        </div>
        <div>
          <label>Ciudad</label>
          <input className="field" value={values.ciudad} onChange={(e) => setField("ciudad", e.target.value)} />
        </div>
      </div>

      <div>
        <label>Dirección</label>
        <input className="field" value={values.direccion} onChange={(e) => setField("direccion", e.target.value)} />
      </div>

      <div>
        <label>Ciudad (catálogo)</label>
        <CiudadSelector
          options={ciudades}
          value={values.ciudadId}
          onChange={(id) => setField("ciudadId", id)}
          placeholder="— Sin definir —"
        />
        <p className="cell-muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
          Se usa para precargar la ciudad de entrega al armar una proforma de venta para este cliente.
        </p>
      </div>

      {formError && <p className="error-text">{formError}</p>}

      <div className="form-actions">
        <button type="button" className="link-button" onClick={() => router.push("/dashboard/clientes")}>
          Cancelar
        </button>
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
