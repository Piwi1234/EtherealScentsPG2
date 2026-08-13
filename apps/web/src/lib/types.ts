export type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  // Solo se usan en subcategorías; los productos los heredan en vivo desde su categoría.
  logisticsCost: string | null;
  shippingCost: string | null;
  securityCost: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CategoryTreeNode = Category & { children: CategoryTreeNode[] };

export type Brand = {
  id: string;
  name: string;
  slug: string;
  categories: { categoryId: string; category: Category }[];
};

export type AttributeType = "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT";

/**
 * NONE: valor único de siempre. MULTI_VALUE: el producto puede tener 1+ valores, no afecta el
 * precio (ej. sabores). PRICED_VARIANT: cada valor elegido genera una variante con su propio
 * precio de compra/utilidad/ID de producto (ej. tamaño). Solo aplica a type='SELECT'.
 */
export type AttributeVariantMode = "NONE" | "MULTI_VALUE" | "PRICED_VARIANT";

export type AttributeOption = {
  id: string;
  attributeId: string;
  value: string;
  /** Color hex (ej. "#c9a96e") del botón de esta opción en el formulario de producto. */
  color: string | null;
};

export type Attribute = {
  id: string;
  categoryId: string;
  name: string;
  type: AttributeType;
  isFilterable: boolean;
  isRequired: boolean;
  /** Si se muestra como columna extra en la tabla de Productos del panel. */
  showInProductList: boolean;
  /** Si se muestra al armar una línea de proforma (ordenado por `orden`). */
  mostrarEnProforma: boolean;
  orden: number;
  variantMode: AttributeVariantMode;
  /** Solo aplica cuando type='SELECT' y variantMode='NONE': el producto puede elegir 1+ opciones
   * de la lista compartida de la categoría (ej. Acordes de un perfume). */
  allowMultiple: boolean;
  options: AttributeOption[];
  inherited: boolean;
};

export type ProductAttributeValue = {
  id: string;
  attributeId: string;
  valueText: string | null;
  valueNumber: string | null;
  valueBoolean: boolean | null;
  optionId: string | null;
  attribute: Attribute;
  option: AttributeOption | null;
};

/** Valor propio de UN producto para un atributo MULTI_VALUE o PRICED_VARIANT (ej. "Menta" de un
 * vape puntual, "50 ML" de un perfume puntual). No se comparte con otros productos. */
export type ProductVariantOptionValue = {
  id: string;
  attributeId: string;
  value: string;
  attribute: Attribute;
};

export type ProductVariantOption = {
  optionValueId: string;
  optionValue: ProductVariantOptionValue;
};

export type ProductVariant = {
  id: string;
  variantCode: string;
  purchasePrice: string;
  utility: string;
  /** Precio Min Bs (manual, opcional) y Descuento Bs (manual) propios de esta variante. */
  minPriceBs: string | null;
  discountBs: string;
  /** Calculado en vivo, misma fórmula que el producto pero con la purchasePrice/utility de la variante. */
  price: number;
  /** Calculado en vivo: price * tipo de cambio del sistema. */
  wholesalePriceBs: number;
  /** Calculado en vivo: (minPriceBs si hay, si no wholesalePriceBs) - discountBs. */
  finalPriceBs: number;
  options: ProductVariantOption[];
};

export type Product = {
  id: string;
  name: string;
  productCode: string;
  purchasePrice: string;
  utility: string;
  /** Precio Min Bs (manual, opcional) y Descuento Bs (manual). Redundantes si hay variantes con precio propio. */
  minPriceBs: string | null;
  discountBs: string;
  /** Calculado en vivo por el backend: purchasePrice + logisticsCost + shippingCost + securityCost (de category) + utility. */
  price: number;
  /** Calculado en vivo: price * tipo de cambio del sistema (Precio May Bs). */
  wholesalePriceBs: number;
  /** Calculado en vivo: (minPriceBs si hay, si no wholesalePriceBs) - discountBs (Precio Final Bs). */
  finalPriceBs: number;
  imageUrl: string | null;
  brandId: string | null;
  categoryId: string;
  brand: Brand | null;
  category: Category;
  attributeValues: ProductAttributeValue[];
  variantOptionValues: ProductVariantOptionValue[];
  variants: ProductVariant[];
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export type ExchangeRateResponse = { exchangeRate: number };

export type Rol = "ADMIN" | "SELLER";

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  ultimoLogin: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TipoCliente = "NATURAL" | "JURIDICA";
export type TipoDocumento = "DNI" | "CI" | "RUC" | "PASAPORTE" | "OTRO";
/** MANUAL: cargado desde gestión. WEB: registro propio del cliente (todavía no implementado). */
export type OrigenCliente = "MANUAL" | "WEB";

export type Cliente = {
  id: string;
  tipo: TipoCliente;
  nombre: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  /** Referencia a la tabla Ciudad (para Proformas: precarga la ciudad de entrega). Independiente del
   * campo `ciudad` de texto libre de arriba, que conviven. */
  ciudadId: string | null;
  ciudadRef: Ciudad | null;
  origen: OrigenCliente;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClienteInput = {
  tipo?: TipoCliente;
  nombre: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  ciudadId?: string;
};

// --- Empresas / Almacenes / Ciudades ---

export type TipoEmpresa = "CASA_MATRIZ" | "SUCURSAL";

export type Empresa = {
  id: string;
  nombre: string;
  tipo: TipoEmpresa;
  razonSocial: string;
  nit: string;
  logoUrl: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmpresaInput = {
  nombre: string;
  tipo: TipoEmpresa;
  razonSocial: string;
  nit: string;
  logoUrl?: string;
  activo?: boolean;
};

export type Ciudad = {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Catálogo de ciudades de origen (de dónde viene la mercadería) — sin relaciones todavía, uso
 * futuro. Distinto de Ciudad (que es la ciudad de ENTREGA del cliente). */
export type CiudadProcedencia = {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Almacen = {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

// --- Proformas ---

export type TipoProforma = "COMPRA" | "VENTA";
export type EstadoProforma = "BORRADOR" | "APROBADA" | "COMPLETADA" | "ANULADA";
export type OrigenAsignacion = "STOCK" | "PROCURA";
export type EstadoSeguimientoProcura = "PENDIENTE" | "COMPRADO" | "ENVIADO";

export type ProformaHistorial = {
  id: string;
  proformaId: string;
  estado: EstadoProforma;
  fecha: string;
  usuarioId: string;
  usuario: { id: string; nombre: string };
  nota: string | null;
};

export type ProformaDetalleAsignacion = {
  id: string;
  proformaDetalleId: string;
  almacenId: string | null;
  almacen: Almacen | null;
  cantidad: number;
  origen: OrigenAsignacion;
  /** Solo tiene sentido mientras origen=PROCURA y cantidad>0 — ver módulo Seguimiento. */
  estadoSeguimiento: EstadoSeguimientoProcura;
  createdAt: string;
};

export type LoteCompra = {
  id: string;
  varianteId: string;
  almacenId: string;
  proformaDetalleId: string;
  costoUnitario: string;
  cantidadInicial: number;
  cantidadDisponible: number;
  fecha: string;
};

// --- Stock ---

export type StockVariante = {
  id: string;
  variantCode: string;
  isDefault: boolean;
  product: { id: string; name: string; productCode: string; imageUrl: string | null };
};

export type StockAlmacenRef = { id: string; nombre: string };

export type StockRow = {
  varianteId: string;
  almacenId: string;
  cantidadFisica: number;
  cantidadReservada: number;
  updatedAt: string;
  variante: StockVariante;
  almacen: StockAlmacenRef;
};

/** LoteCompra anidado con variante/almacén — para el historial de movimientos del módulo de Stock,
 * distinto del LoteCompra "crudo" (solo FKs) que se usa dentro de ProformaDetalle. */
export type LoteCompraConDetalle = LoteCompra & {
  variante: { id: string; variantCode: string; product: { id: string; name: string; productCode: string } };
  almacen: { id: string; nombre: string };
  /** Tipo de cambio propio de la proforma de compra que trajo este lote — para valorar costoUnitario
   * en Bs. Null en lotes de compras creadas antes de este campo. */
  proformaDetalle: { proforma: { tipoCambioProf: string | null } };
};

/** Variante tal como viene anidada en ProformaDetalle — campos crudos, sin los precios calculados en
 * vivo que sí trae el endpoint de catálogo (acá no hace falta: precioUnitario/subtotal ya están en la
 * línea). */
export type ProformaDetalleVariante = {
  id: string;
  variantCode: string;
  purchasePrice: string;
  utility: string;
  minPriceBs: string | null;
  discountBs: string;
  isDefault: boolean;
  options: ProductVariantOption[];
  product: {
    id: string;
    name: string;
    productCode: string;
    imageUrl: string | null;
    categoryId: string;
    brandId: string | null;
    brand: { id: string; name: string; slug: string } | null;
    attributeValues: ProductAttributeValue[];
    variantOptionValues: ProductVariantOptionValue[];
  };
};

export type ProformaDetalle = {
  id: string;
  proformaId: string;
  varianteId: string;
  variante: ProformaDetalleVariante;
  cantidad: number;
  /** VENTA: nace de precioFinalBs, editable. */
  precioUnitario: string | null;
  /** COMPRA: capturados por línea, no heredados del catálogo. */
  precioCompra: string | null;
  costoEnvio: string | null;
  costoSeguridad: string | null;
  costoLogistica: string | null;
  subtotal: string;
  asignaciones: ProformaDetalleAsignacion[];
  loteCompras: LoteCompra[];
  createdAt: string;
  updatedAt: string;
};

export type Proforma = {
  id: string;
  tipo: TipoProforma;
  estado: EstadoProforma;
  empresaId: string;
  empresa: Empresa;
  clienteId: string | null;
  cliente: Cliente | null;
  /** Para VENTA se fija al aprobar (ahí se resuelve el reparto/reserva de stock contra este almacén);
   * para COMPRA se fija recién al completar. Null hasta ese momento en ambos casos. */
  almacenId: string | null;
  almacen: Almacen | null;
  ciudadEntregaId: string | null;
  ciudadEntrega: Ciudad | null;
  /** Solo COMPRA: de dónde viene la mercadería (informativo) y el tipo de cambio propio de ESTA
   * compra puntual, para valorar en Bs sin depender del tipo de cambio del sistema. Ambos null en VENTA. */
  ciudadProcedenciaId: string | null;
  ciudadProcedencia: CiudadProcedencia | null;
  tipoCambioProf: string | null;
  creadoPorId: string;
  creadoPor: { id: string; nombre: string; email: string; rol: Rol };
  /** Aplica sobre el total del documento, no por línea. */
  descuentoGeneral: string;
  /** % del total que debe adelantar el cliente (0-100). El monto y el saldo se calculan en vivo a
   * partir del total de las líneas. Informativo por ahora, sin ligar a un módulo de pagos. */
  adelantoPorcentaje: string | null;
  fecha: string;
  detalles: ProformaDetalle[];
  historial: ProformaHistorial[];
  createdAt: string;
  updatedAt: string;
};

export type ProformaInput = {
  tipo: TipoProforma;
  empresaId: string;
  clienteId?: string;
  ciudadEntregaId?: string;
  ciudadProcedenciaId?: string;
  tipoCambioProf?: number;
  descuentoGeneral?: number;
  adelantoPorcentaje?: number;
};

export type DetalleVentaInput = { varianteId: string; cantidad: number; precioUnitario?: number };

export type DetalleCompraInput = {
  varianteId: string;
  cantidad: number;
  precioCompra: number;
  costoEnvio: number;
  costoSeguridad: number;
  costoLogistica: number;
};

export type UpdateDetalleInput = {
  cantidad?: number;
  precioUnitario?: number;
  precioCompra?: number;
  costoEnvio?: number;
  costoSeguridad?: number;
  costoLogistica?: number;
};

export type AprobarProformaInput = { almacenId?: string };

export type AsignacionLoteInput = { proformaDetalleAsignacionId: string; loteCompraId: string; cantidad: number };

export type CompletarProformaInput = { almacenId?: string; asignaciones?: AsignacionLoteInput[] };

/** Una línea a Procura (venta aprobada sin stock suficiente todavía) vista desde la vista agregada de
 * Seguimiento — todas las proformas VENTA a la vez, no desde dentro de una proforma puntual. */
export type SeguimientoLinea = {
  id: string;
  cantidad: number;
  estadoSeguimiento: EstadoSeguimientoProcura;
  proformaDetalle: {
    proforma: { id: string; fecha: string; empresa: { id: string; nombre: string } };
    variante: ProformaDetalleVariante;
  };
};
