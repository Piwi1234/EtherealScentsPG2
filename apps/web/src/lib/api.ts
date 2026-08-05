import { clearSession } from "./auth";
import type { Cliente, ClienteInput, Page } from "./types";

const DEFAULT_API_HOST = "http://localhost:4100";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_HOST;
const API_BASE = typeof window !== "undefined" && !process.env.NEXT_PUBLIC_API_URL ? "/api" : `${API_URL}/api`;

/** Origen del backend (sin /api), para construir URLs de archivos estáticos como /uploads/... */
export const API_ORIGIN = API_URL;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

  if (typeof window !== "undefined") {
    init.headers = init.headers ?? {};
    const token = localStorage.getItem("app_token");
    if (token) {
      (init.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new Error(`API request failed: ${url} — ${String(error)}`);
  }

  if (response.status === 401 && typeof window !== "undefined") {
    clearSession();
    window.location.href = "/login";
    // La navegación va a desmontar todo; esto solo evita que el código que llamó siga ejecutando.
    throw new ApiError(401, "Sesión expirada.");
  }

  const text = await response.text();

  if (!response.ok) {
    let message = "Ocurrió un error, intenta nuevamente";
    if (text) {
      try {
        const body = JSON.parse(text) as { message?: string | string[] };
        if (Array.isArray(body.message)) message = body.message.join(", ");
        else if (body.message) message = body.message;
      } catch {
        message = text;
      }
    }
    throw new ApiError(response.status, message);
  }

  return (text ? JSON.parse(text) : undefined) as T;
}

export function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, method: "GET" });
}

export function apiPost<T>(path: string, data: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

export function apiPatch<T>(path: string, data: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

export function apiPut<T>(path: string, data: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE" });
}

export function apiUpload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  // Sin Content-Type manual: el browser arma el boundary multipart correcto.
  return apiRequest<T>(path, { method: "POST", body: formData });
}

// --- Clientes ---

export function getClientes(query: { search?: string; activo?: string; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.activo) params.set("activo", query.activo);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return apiGet<Page<Cliente>>(`/clientes${qs ? `?${qs}` : ""}`);
}

export function getCliente(id: string) {
  return apiGet<Cliente>(`/clientes/${id}`);
}

export function createCliente(data: ClienteInput) {
  return apiPost<Cliente>("/clientes", data);
}

export function updateCliente(id: string, data: Partial<ClienteInput>) {
  return apiPatch<Cliente>(`/clientes/${id}`, data);
}

export function deleteCliente(id: string) {
  return apiDelete<Cliente>(`/clientes/${id}`);
}
