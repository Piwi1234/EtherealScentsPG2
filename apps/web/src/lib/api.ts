import { clearSession } from "./auth";
import type {
  Almacen,
  AprobarProformaInput,
  Brand,
  Cartera,
  CarteraInput,
  Category,
  Ciudad,
  Cliente,
  ClienteInput,
  CompletarProformaInput,
  CuentaPorCobrarConProforma,
  DetalleCompraInput,
  DetalleVentaInput,
  Empresa,
  EmpresaInput,
  EstadoCuentaPorCobrar,
  EstadoSeguimientoProcura,
  LoteCompraConDetalle,
  MonedaCartera,
  MovimientoCartera,
  MovimientoInput,
  NaturalezaMovimiento,
  Page,
  PagoCliente,
  PaisProcedencia,
  PresentacionVenta,
  PresentacionVentaInput,
  Product,
  Proforma,
  ProformaInput,
  Proveedor,
  ProveedorInput,
  RegistroLinea,
  SeguimientoLinea,
  StockRow,
  TipoMovimiento,
  TipoMovimientoConCartera,
  TipoMovimientoInput,
  Traspaso,
  TraspasoAlmacen,
  TraspasoAlmacenInput,
  TraspasoInput,
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

/** Para respuestas binarias (ej. PDF) — apiRequest asume texto/JSON, esto dispara la descarga en el
 * navegador directamente en vez de devolver el body parseado. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("app_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    throw new Error(`API request failed: ${url} — ${String(error)}`);
  }

  if (response.status === 401 && typeof window !== "undefined") {
    clearSession();
    window.location.href = "/login";
    throw new ApiError(401, "Sesión expirada.");
  }
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || "No se pudo descargar el archivo.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
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

export function getPagosCliente(id: string, query: { page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return apiGet<Page<PagoCliente>>(`/clientes/${id}/pagos${qs ? `?${qs}` : ""}`);
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

/** Público (sin auth) — nombre/logo de la casa matriz, para el navbar de la landing y el login. */
export function getCasaMatrizLogo() {
  return apiGet<{ nombre: string | null; logoUrl: string | null }>("/empresas/casa-matriz-logo");
}

/** Público (sin auth) — imágenes de "Propuesta de valor" y "Sobre nosotros" del home (ver Grid
 * Imágenes en Configuración). */
export function getLandingImages() {
  return apiGet<{ valueImageUrl: string | null; aboutImageUrl: string | null }>("/settings/landing-images");
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

// --- Países de procedencia ---

export function getPaisesProcedencia(query: { page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiGet<Page<PaisProcedencia>>(`/paises-procedencia${qs ? `?${qs}` : ""}`);
}

export function createPaisProcedencia(nombre: string) {
  return apiPost<PaisProcedencia>("/paises-procedencia", { nombre });
}

export function deactivatePaisProcedencia(id: string) {
  return apiDelete<PaisProcedencia>(`/paises-procedencia/${id}`);
}

// --- Proveedores ---

export function getProveedores(query: { page?: number; pageSize?: number; activo?: string; search?: string } = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.activo) params.set("activo", query.activo);
  if (query.search) params.set("search", query.search);
  const qs = params.toString();
  return apiGet<Page<Proveedor>>(`/proveedores${qs ? `?${qs}` : ""}`);
}

export function createProveedor(data: ProveedorInput) {
  return apiPost<Proveedor>("/proveedores", data);
}

export function updateProveedor(id: string, data: Partial<ProveedorInput>) {
  return apiPatch<Proveedor>(`/proveedores/${id}`, data);
}

export function deleteProveedor(id: string) {
  return apiDelete<Proveedor>(`/proveedores/${id}`);
}

// --- Almacenes ---

export function getAlmacenes(query: { page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiGet<Page<Almacen>>(`/almacenes${qs ? `?${qs}` : ""}`);
}

export function createAlmacen(data: { nombre: string }) {
  return apiPost<Almacen>("/almacenes", data);
}

export function updateAlmacen(id: string, data: { nombre?: string; activo?: boolean }) {
  return apiPatch<Almacen>(`/almacenes/${id}`, data);
}

export function deleteAlmacen(id: string) {
  return apiDelete<Almacen>(`/almacenes/${id}`);
}

// --- Stock ---

export function getStock(
  query: {
    almacenId?: string;
    search?: string;
    categoryId?: string;
    brandId?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (query.almacenId) params.set("almacenId", query.almacenId);
  if (query.search) params.set("search", query.search);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.brandId) params.set("brandId", query.brandId);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiGet<Page<StockRow>>(`/stock${qs ? `?${qs}` : ""}`);
}

export function getCategories() {
  return apiGet<Category[]>("/categories");
}

export function getBrands() {
  return apiGet<Brand[]>("/brands");
}

/** categoryId ya expande a categoría padre + subcategorías del lado del backend (a diferencia de
 * /brands, que hace match exacto — ahí el cascade se resuelve del lado del cliente). */
export function getProducts(query: { categoryId?: string; brandId?: string; search?: string; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.brandId) params.set("brandId", query.brandId);
  if (query.search) params.set("search", query.search);
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiGet<Page<Product>>(`/products${qs ? `?${qs}` : ""}`);
}

export function getLotesCompra(
  query: {
    varianteId?: string;
    almacenId?: string;
    estado?: "disponible" | "agotado";
    page?: number;
    pageSize?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (query.varianteId) params.set("varianteId", query.varianteId);
  if (query.almacenId) params.set("almacenId", query.almacenId);
  if (query.estado) params.set("estado", query.estado);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiGet<Page<LoteCompraConDetalle>>(`/stock/lotes${qs ? `?${qs}` : ""}`);
}

export function getTraspasosAlmacen(
  query: {
    varianteId?: string;
    almacenId?: string;
    categoryId?: string;
    brandId?: string;
    productId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (query.varianteId) params.set("varianteId", query.varianteId);
  if (query.almacenId) params.set("almacenId", query.almacenId);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.brandId) params.set("brandId", query.brandId);
  if (query.productId) params.set("productId", query.productId);
  if (query.fechaDesde) params.set("fechaDesde", query.fechaDesde);
  if (query.fechaHasta) params.set("fechaHasta", query.fechaHasta);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiGet<Page<TraspasoAlmacen>>(`/traspasos-almacen${qs ? `?${qs}` : ""}`);
}

export function createTraspasoAlmacen(data: TraspasoAlmacenInput) {
  return apiPost<TraspasoAlmacen>("/traspasos-almacen", data);
}

// --- Proformas ---

export function getProformas(
  query: {
    tipo?: string;
    estado?: string;
    empresaId?: string;
    creadoPorId?: string;
    clienteId?: string;
    proveedorId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (query.tipo) params.set("tipo", query.tipo);
  if (query.estado) params.set("estado", query.estado);
  if (query.empresaId) params.set("empresaId", query.empresaId);
  if (query.creadoPorId) params.set("creadoPorId", query.creadoPorId);
  if (query.clienteId) params.set("clienteId", query.clienteId);
  if (query.proveedorId) params.set("proveedorId", query.proveedorId);
  if (query.fechaDesde) params.set("fechaDesde", query.fechaDesde);
  if (query.fechaHasta) params.set("fechaHasta", query.fechaHasta);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return apiGet<Page<Proforma>>(`/proformas${qs ? `?${qs}` : ""}`);
}

export function getProforma(id: string) {
  return apiGet<Proforma>(`/proformas/${id}`);
}

export function getVendedores() {
  return apiGet<{ id: string; nombre: string }[]>("/proformas/vendedores");
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

export function getPresentaciones(varianteId: string) {
  return apiGet<PresentacionVenta[]>(`/products/variants/${varianteId}/presentaciones`);
}

export function createPresentacion(varianteId: string, data: { cantidadMl: number; precioVentaBs: number }) {
  return apiPost<PresentacionVenta>(`/products/variants/${varianteId}/presentaciones`, data);
}

export function updatePresentacion(id: string, data: PresentacionVentaInput) {
  return apiPatch<PresentacionVenta>(`/products/presentaciones/${id}`, data);
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

export function deleteProforma(id: string) {
  return apiDelete<void>(`/proformas/${id}`);
}

export function aprobarProforma(id: string, data: AprobarProformaInput = {}) {
  return apiPost<Proforma>(`/proformas/${id}/aprobar`, data);
}

export function anularProforma(id: string, nota?: string) {
  return apiPost<Proforma>(`/proformas/${id}/anular`, { nota });
}

export function completarProforma(id: string, data: CompletarProformaInput) {
  return apiPost<Proforma>(`/proformas/${id}/completar`, data);
}

export function downloadProformaPdf(id: string, codigo: string) {
  return apiDownload(`/proformas/${id}/pdf`, `proforma-${codigo}.pdf`);
}

// --- Seguimiento (Procura pendiente) ---

export function getSeguimientoPendientes(
  query: { estado?: string; empresaId?: string; categoryId?: string; page?: number; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (query.estado) params.set("estado", query.estado);
  if (query.empresaId) params.set("empresaId", query.empresaId);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return apiGet<Page<SeguimientoLinea>>(`/proformas/seguimiento${qs ? `?${qs}` : ""}`);
}

export function updateSeguimientoEstado(id: string, estado: EstadoSeguimientoProcura, cantidad: number) {
  return apiPatch<SeguimientoLinea>(`/proformas/seguimiento/${id}`, { estado, cantidad });
}

// --- Registros ---

export function getRegistros(
  query: {
    tipo: string;
    codigo?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    categoryId?: string;
    brandId?: string;
    productId?: string;
    clienteId?: string;
    proveedorId?: string;
    page?: number;
    limit?: number;
  },
) {
  const params = new URLSearchParams();
  params.set("tipo", query.tipo);
  if (query.codigo) params.set("codigo", query.codigo);
  if (query.fechaDesde) params.set("fechaDesde", query.fechaDesde);
  if (query.fechaHasta) params.set("fechaHasta", query.fechaHasta);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.brandId) params.set("brandId", query.brandId);
  if (query.productId) params.set("productId", query.productId);
  if (query.clienteId) params.set("clienteId", query.clienteId);
  if (query.proveedorId) params.set("proveedorId", query.proveedorId);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  return apiGet<Page<RegistroLinea>>(`/proformas/registros?${params.toString()}`);
}

// --- Financiero (Contabilidad) ---

export function getCarteras(query: { moneda?: string; activo?: boolean } = {}) {
  const params = new URLSearchParams();
  if (query.moneda) params.set("moneda", query.moneda);
  if (query.activo !== undefined) params.set("activo", String(query.activo));
  const qs = params.toString();
  return apiGet<Cartera[]>(`/contabilidad/carteras${qs ? `?${qs}` : ""}`);
}

export function getCartera(id: string) {
  return apiGet<Cartera>(`/contabilidad/carteras/${id}`);
}

export function createCartera(data: { moneda: MonedaCartera; nombre: string }) {
  return apiPost<Cartera>("/contabilidad/carteras", data);
}

export function updateCartera(id: string, data: CarteraInput) {
  return apiPatch<Cartera>(`/contabilidad/carteras/${id}`, data);
}

export function deactivateCartera(id: string) {
  return apiDelete<Cartera>(`/contabilidad/carteras/${id}`);
}

export function getTiposMovimiento(carteraId: string, query: { naturaleza?: string; activo?: boolean } = {}) {
  const params = new URLSearchParams();
  if (query.naturaleza) params.set("naturaleza", query.naturaleza);
  if (query.activo !== undefined) params.set("activo", String(query.activo));
  const qs = params.toString();
  return apiGet<TipoMovimiento[]>(`/contabilidad/carteras/${carteraId}/tipos${qs ? `?${qs}` : ""}`);
}

export function getTiposMovimientoGlobal(query: { carteraId?: string; naturaleza?: string; activo?: boolean } = {}) {
  const params = new URLSearchParams();
  if (query.carteraId) params.set("carteraId", query.carteraId);
  if (query.naturaleza) params.set("naturaleza", query.naturaleza);
  if (query.activo !== undefined) params.set("activo", String(query.activo));
  const qs = params.toString();
  return apiGet<TipoMovimientoConCartera[]>(`/contabilidad/tipos${qs ? `?${qs}` : ""}`);
}

export function createTipoMovimiento(carteraId: string, data: { nombre: string; naturaleza: NaturalezaMovimiento }) {
  return apiPost<TipoMovimiento>(`/contabilidad/carteras/${carteraId}/tipos`, data);
}

export function updateTipoMovimiento(id: string, data: TipoMovimientoInput) {
  return apiPatch<TipoMovimiento>(`/contabilidad/tipos/${id}`, data);
}

export function getMovimientos(
  carteraId: string,
  query: { fechaDesde?: string; fechaHasta?: string; page?: number; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (query.fechaDesde) params.set("fechaDesde", query.fechaDesde);
  if (query.fechaHasta) params.set("fechaHasta", query.fechaHasta);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return apiGet<Page<MovimientoCartera>>(`/contabilidad/carteras/${carteraId}/movimientos${qs ? `?${qs}` : ""}`);
}

export function createMovimiento(carteraId: string, data: MovimientoInput) {
  return apiPost<MovimientoCartera>(`/contabilidad/carteras/${carteraId}/movimientos`, data);
}

export function createTraspaso(data: TraspasoInput) {
  return apiPost<Traspaso>("/contabilidad/traspasos", data);
}

export function getCuentasPorCobrar(
  query: {
    estado?: EstadoCuentaPorCobrar;
    clienteId?: string;
    codigo?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (query.estado) params.set("estado", query.estado);
  if (query.clienteId) params.set("clienteId", query.clienteId);
  if (query.codigo) params.set("codigo", query.codigo);
  if (query.fechaDesde) params.set("fechaDesde", query.fechaDesde);
  if (query.fechaHasta) params.set("fechaHasta", query.fechaHasta);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return apiGet<Page<CuentaPorCobrarConProforma>>(`/contabilidad/cuentas-por-cobrar${qs ? `?${qs}` : ""}`);
}

export function cobrarCuenta(id: string, data: { monto: number; carteraId: string }) {
  return apiPost<CuentaPorCobrarConProforma>(`/contabilidad/cuentas-por-cobrar/${id}/cobrar`, data);
}
