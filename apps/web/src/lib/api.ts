import { clearSession } from "./auth";
import type {
  Almacen,
  Ciudad,
  Cliente,
  ClienteInput,
  DetalleCompraInput,
  DetalleVentaInput,
  Empresa,
  EmpresaInput,
  LoteCompraConDetalle,
  Page,
  Proforma,
  ProformaDetalleSeguimiento,
  ProformaInput,
  SeguimientoLinea,
  StockRow,
  UpdateDetalleInput,
} from "./types";

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

// --- Empresas ---

export function getEmpresas(query: { page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiGet<Page<Empresa>>(`/empresas${qs ? `?${qs}` : ""}`);
}

export function createEmpresa(data: EmpresaInput) {
  return apiPost<Empresa>("/empresas", data);
}

export function updateEmpresa(id: string, data: Partial<EmpresaInput>) {
  return apiPatch<Empresa>(`/empresas/${id}`, data);
}

export function deleteEmpresa(id: string) {
  return apiDelete<Empresa>(`/empresas/${id}`);
}

// --- Ciudades ---

export function getCiudades(query: { page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiGet<Page<Ciudad>>(`/ciudades${qs ? `?${qs}` : ""}`);
}

export function createCiudad(nombre: string) {
  return apiPost<Ciudad>("/ciudades", { nombre });
}

export function deleteCiudad(id: string) {
  return apiDelete<Ciudad>(`/ciudades/${id}`);
}

// --- Almacenes ---

export function getAlmacenes(query: { ciudadId?: string; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (query.ciudadId) params.set("ciudadId", query.ciudadId);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiGet<Page<Almacen>>(`/almacenes${qs ? `?${qs}` : ""}`);
}

export function createAlmacen(data: { nombre: string; ciudadId: string }) {
  return apiPost<Almacen>("/almacenes", data);
}

export function updateAlmacen(id: string, data: { nombre?: string; ciudadId?: string; activo?: boolean }) {
  return apiPatch<Almacen>(`/almacenes/${id}`, data);
}

export function deleteAlmacen(id: string) {
  return apiDelete<Almacen>(`/almacenes/${id}`);
}

// --- Stock ---

export function getStock(query: { almacenId?: string; search?: string; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (query.almacenId) params.set("almacenId", query.almacenId);
  if (query.search) params.set("search", query.search);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiGet<Page<StockRow>>(`/stock${qs ? `?${qs}` : ""}`);
}

export function getLotesCompra(
  query: { varianteId?: string; almacenId?: string; page?: number; pageSize?: number } = {},
) {
  const params = new URLSearchParams();
  if (query.varianteId) params.set("varianteId", query.varianteId);
  if (query.almacenId) params.set("almacenId", query.almacenId);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiGet<Page<LoteCompraConDetalle>>(`/stock/lotes${qs ? `?${qs}` : ""}`);
}

// --- Proformas ---

export function getProformas(query: { tipo?: string; estado?: string; empresaId?: string; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (query.tipo) params.set("tipo", query.tipo);
  if (query.estado) params.set("estado", query.estado);
  if (query.empresaId) params.set("empresaId", query.empresaId);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return apiGet<Page<Proforma>>(`/proformas${qs ? `?${qs}` : ""}`);
}

export function getProforma(id: string) {
  return apiGet<Proforma>(`/proformas/${id}`);
}

export function createProforma(data: ProformaInput) {
  return apiPost<Proforma>("/proformas", data);
}

export function updateProforma(id: string, data: Partial<ProformaInput>) {
  return apiPatch<Proforma>(`/proformas/${id}`, data);
}

export function addDetalleVenta(proformaId: string, data: DetalleVentaInput) {
  return apiPost<Proforma>(`/proformas/${proformaId}/detalles/venta`, data);
}

export function addDetalleCompra(proformaId: string, data: DetalleCompraInput) {
  return apiPost<Proforma>(`/proformas/${proformaId}/detalles/compra`, data);
}

export function updateDetalle(proformaId: string, detalleId: string, data: UpdateDetalleInput) {
  return apiPatch<Proforma>(`/proformas/${proformaId}/detalles/${detalleId}`, data);
}

export function removeDetalle(proformaId: string, detalleId: string) {
  return apiDelete<void>(`/proformas/${proformaId}/detalles/${detalleId}`);
}

export function enviarProforma(id: string) {
  return apiPost<Proforma>(`/proformas/${id}/enviar`, {});
}

export function aprobarProforma(id: string) {
  return apiPost<Proforma>(`/proformas/${id}/aprobar`, {});
}

export function rechazarProforma(id: string, nota?: string) {
  return apiPost<Proforma>(`/proformas/${id}/rechazar`, { nota });
}

export function anularProforma(id: string, nota?: string) {
  return apiPost<Proforma>(`/proformas/${id}/anular`, { nota });
}

export function completarProforma(id: string) {
  return apiPost<Proforma>(`/proformas/${id}/completar`, {});
}

// --- Seguimiento interno ---

export function getSeguimiento(detalleId: string) {
  return apiGet<ProformaDetalleSeguimiento[]>(`/proformas/detalles/${detalleId}/seguimiento`);
}

export function createSeguimiento(detalleId: string, data: { estado: string; nota?: string }) {
  return apiPost<ProformaDetalleSeguimiento>(`/proformas/detalles/${detalleId}/seguimiento`, data);
}

export function getSeguimientoPendientes(
  query: { estado?: string; tipo?: string; empresaId?: string; page?: number; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (query.estado) params.set("estado", query.estado);
  if (query.tipo) params.set("tipo", query.tipo);
  if (query.empresaId) params.set("empresaId", query.empresaId);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return apiGet<Page<SeguimientoLinea>>(`/proformas/seguimiento${qs ? `?${qs}` : ""}`);
}
