export type CarouselImage = {
  id: string;
  categoryId: string | null;
  imageUrl: string;
  // Link opcional al que redirige la imagen en el sitio público al hacer click — null la deja
  // decorativa (sin click).
  url: string | null;
  // Texto opcional superpuesto sobre la imagen — solo lo consume el bloque de categoría del home
  // ("Producto destacado"): titulo1 = subtítulo chico arriba, titulo2 = título grande debajo.
  titulo1: string | null;
  titulo2: string | null;
  orden: number;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  // Solo se usan en subcategorías; los productos los heredan en vivo desde su categoría.
  logisticsCost: string | null;
  shippingCost: string | null;
  securityCost: string | null;
  // Solo aplica a categorías raíz (sin padre) — nota interna libre.
  comentario: string | null;
  // Solo aplica a categorías raíz — orden manual de su bloque en el Home (menor primero). Las
  // subcategorías siempre quedan en 0.
  orden: number;
  // Solo aplica a categorías raíz — el carrusel del bloque "Producto destacado" del home.
  // Ordenado por `orden` (ya viene ordenado del backend).
  carouselImages: CarouselImage[];
  // Solo aplica a categorías raíz — el carrusel del hero de /categoria/[id], independiente del de
  // arriba (tamaño panorámico en vez de cuadrado). Se muestra tanto en la página de esa raíz como
  // en la de todas sus subcategorías (que no tienen uno propio, comparten el de su padre).
  heroCarouselImages: CarouselImage[];
  createdAt: string;
  updatedAt: string;
};

export type CategoryTreeNode = Category & { children: CategoryTreeNode[] };

export type Brand = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  categories: { categoryId: string; category: Category }[];
};

export type BrandImportReport = {
  total: number;
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
};

export type AttributeType = "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT";

/**
 * NONE: valor único de siempre. MULTI_VALUE: el producto puede tener 1+ valores, no afecta el
 * precio (ej. sabores). PRICED_VARIANT: cada valor elegido genera una variante con su propio
 * precio de compra/utilidad/ID de producto (ej. tamaño). Solo aplica a type='SELECT'.
 */
export type AttributeVariantMode = "NONE" | "MULTI_VALUE" | "PRICED_VARIANT";

/** PZA: de siempre, stock/venta en unidades. ML: la variante no se vende directo — su stock son ml
 * sueltos, comprados por lote como cualquier otra variante y vendidos a través de sus
 * PresentacionVenta (subvariantes con precio propio, ej. decants de 5/10/30 ml). */
export type UnidadVariante = "PZA" | "ML";

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
  /** "Add May" (manual, opcional, campo minPriceBs) y Descuento Bs (manual) propios de esta variante. */
  minPriceBs: string | null;
  discountBs: string;
  /** true = variante "default" auto-provista (catálogo simple); su discountBs queda congelado al
   * crearse, así que no sirve para saber si el producto está en oferta (ver `hasDiscount`). */
  isDefault: boolean;
  /** Calculado en vivo, misma fórmula que el producto pero con la purchasePrice/utility de la variante. */
  price: number;
  /** Calculado en vivo: price * tipo de cambio del sistema. */
  wholesalePriceBs: number;
  /** Calculado en vivo: (wholesalePriceBs + minPriceBs) - discountBs. */
  finalPriceBs: number;
  /** Se fija al crear la variante; inmutable después. */
  unidad: UnidadVariante;
  /** Imagen propia de esta variante — solo aplica a unidad=PZA. Si es null, los listados caen al
   * imageUrl del producto. */
  imageUrl: string | null;
  /** Control de catálogo — todavía no lo consume ningún flujo automático. */
  disponible: boolean;
  options: ProductVariantOption[];
};

/** Subvariante con precio propio de una ProductVariant con unidad = ML (ej. decant de 10ml). */
export type PresentacionVenta = {
  id: string;
  varianteId: string;
  cantidadMl: number;
  precioVentaBs: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PresentacionVentaInput = { cantidadMl?: number; precioVentaBs?: number; activo?: boolean };

export type Product = {
  id: string;
  name: string;
  // Se genera solo al crear el producto (nunca cambia después, aunque cambie el nombre) — URL
  // pública corta (/producto/[slug]) en vez del uuid.
  slug: string;
  productCode: string;
  purchasePrice: string;
  utility: string;
  /** "Add May" (manual, opcional, campo minPriceBs) y Descuento Bs (manual). Redundantes si hay variantes con precio propio. */
  minPriceBs: string | null;
  discountBs: string;
  /** Calculado en vivo por el backend: purchasePrice + logisticsCost + shippingCost + securityCost (de category) + utility. */
  price: number;
  /** Calculado en vivo: price * tipo de cambio del sistema (Precio May Bs). */
  wholesalePriceBs: number;
  /** Calculado en vivo: (wholesalePriceBs + minPriceBs) - discountBs (Precio Final Bs). */
  finalPriceBs: number;
  imageUrl: string | null;
  brandId: string | null;
  categoryId: string;
  brand: Brand | null;
  category: Category;
  attributeValues: ProductAttributeValue[];
  variantOptionValues: ProductVariantOptionValue[];
  variants: ProductVariant[];
  createdAt: string;
};

/** Contacto de WhatsApp ofrecido para solicitar cotización desde el carrito del sitio público
 * (Gestión → Configuración → Carrito Whatsapp). */
export type CarritoWhatsappContacto = {
  id: string;
  nombre: string;
  whatsapp: string;
  descripcion: string | null;
  imagenUrl: string | null;
  createdAt: string;
  updatedAt: string;
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

/** Catálogo de países de origen (de dónde viene la mercadería). Distinto de Ciudad (que es la
 * ciudad de ENTREGA del cliente). Usado en Proforma (solo COMPRA) y en Proveedor. */
export type PaisProcedencia = {
  id: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

/** A quién se le compra. paisProcedenciaId es obligatorio a nivel de servicio. */
export type Proveedor = {
  id: string;
  nombre: string;
  paisProcedenciaId: string | null;
  paisProcedencia: PaisProcedencia | null;
  nota: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProveedorInput = {
  nombre: string;
  paisProcedenciaId: string;
  nota?: string;
  activo?: boolean;
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
  unidad: UnidadVariante;
  product: {
    id: string;
    name: string;
    productCode: string;
    imageUrl: string | null;
    brand: { id: string; name: string } | null;
    attributeValues: ProductAttributeValue[];
    variantOptionValues: ProductVariantOptionValue[];
  };
  options: ProductVariantOption[];
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
  variante: { id: string; variantCode: string; unidad: UnidadVariante; product: { id: string; name: string; productCode: string } };
  almacen: { id: string; nombre: string };
  /** Tipo de cambio propio de la proforma de compra que trajo este lote — para valorar costoUnitario
   * en Bs. Null en lotes de compras creadas antes de este campo. */
  proformaDetalle: { proforma: { tipoCambioProf: string | null } };
};

export type TraspasoAlmacenLote = { id: string; loteOrigenId: string; loteDestinoId: string; cantidad: number };

/** Traspaso de stock físico entre almacenes — instantáneo e inmutable, mueve también los LoteCompra
 * usados (ver doc-comment de TraspasoAlmacen en schema.prisma). */
export type TraspasoAlmacen = {
  id: string;
  fecha: string;
  varianteId: string;
  variante: {
    id: string;
    variantCode: string;
    unidad: UnidadVariante;
    product: {
      id: string;
      name: string;
      productCode: string;
      brand: { id: string; name: string } | null;
      attributeValues: ProductAttributeValue[];
      variantOptionValues: ProductVariantOptionValue[];
    };
    options: ProductVariantOption[];
  };
  almacenOrigenId: string;
  almacenOrigen: { id: string; nombre: string };
  almacenDestinoId: string;
  almacenDestino: { id: string; nombre: string };
  cantidad: number;
  nota: string | null;
  creadoPor: { id: string; nombre: string };
  createdAt: string;
  lotes: TraspasoAlmacenLote[];
};

export type TraspasoAlmacenInput = {
  varianteId: string;
  almacenOrigenId: string;
  almacenDestinoId: string;
  lotes: { loteCompraId: string; cantidad: number }[];
  nota?: string;
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
  unidad: UnidadVariante;
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
  /** VENTA de una variante unidad=ML: qué presentación (subvariante) se vendió en esta línea. */
  presentacionVentaId: string | null;
  presentacionVenta: PresentacionVenta | null;
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
  /** Código corto para mostrar/buscar en vez del id UUID — no secuencial (ver schema.prisma). */
  codigo: string;
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
  /** Solo COMPRA: a quién se le compra — mismo rol que cliente cumple en VENTA. */
  proveedorId: string | null;
  proveedor: Proveedor | null;
  /** Solo COMPRA: de dónde viene la mercadería (informativo) y el tipo de cambio propio de ESTA
   * compra puntual, para valorar en Bs sin depender del tipo de cambio del sistema. Ambos null en VENTA. */
  paisProcedenciaId: string | null;
  paisProcedencia: PaisProcedencia | null;
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
  /** Solo VENTA, y solo si al completar quedó saldo pendiente (ver proforma-completion.service.ts). */
  cuentaPorCobrar: CuentaPorCobrar | null;
  createdAt: string;
  updatedAt: string;
};

export type EstadoCuentaPorCobrar = "PENDIENTE" | "COMPLETADO";

export type CuentaPorCobrar = {
  id: string;
  montoAdeudado: string;
  estado: EstadoCuentaPorCobrar;
  createdAt: string;
  updatedAt: string;
};

/** La misma fila, pero con la proforma que la originó — así vienen el listado y el cobro del gestor
 * de Cuentas por Cobrar (GET/POST /contabilidad/cuentas-por-cobrar). La que cuelga embebida de
 * Proforma.cuentaPorCobrar es la versión sin este campo (evita el ciclo proforma → cuenta → proforma). */
export type CuentaPorCobrarConProforma = CuentaPorCobrar & {
  proforma: { id: string; codigo: string; fecha: string; cliente: { id: string; nombre: string } | null };
};

export type ProformaInput = {
  tipo: TipoProforma;
  empresaId: string;
  clienteId?: string;
  ciudadEntregaId?: string;
  proveedorId?: string;
  paisProcedenciaId?: string;
  tipoCambioProf?: number;
  descuentoGeneral?: number;
  adelantoPorcentaje?: number;
};

// cantidad/precioUnitario son obligatorios salvo que se venda por presentacionVentaId (variante
// unidad=ML), donde el backend los resuelve solo a partir de numPresentaciones.
export type DetalleVentaInput = {
  varianteId: string;
  cantidad?: number;
  precioUnitario?: number;
  presentacionVentaId?: string;
  numPresentaciones?: number;
};

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

export type AprobarProformaInput = { almacenId?: string; carteraId?: string };

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

/** Una línea de proforma (COMPRA o VENTA) vista desde el ledger de Registros — todas las proformas
 * de ese tipo a la vez, filtrable por fecha/categoría/marca/producto. */
export type RegistroLinea = {
  id: string;
  cantidad: number;
  precioUnitario: string | null;
  precioCompra: string | null;
  costoEnvio: string | null;
  costoSeguridad: string | null;
  costoLogistica: string | null;
  subtotal: string;
  proforma: {
    id: string;
    codigo: string;
    fecha: string;
    empresa: { id: string; nombre: string };
    cliente: { id: string; nombre: string } | null;
    proveedor: { id: string; nombre: string } | null;
    paisProcedencia: { id: string; nombre: string } | null;
    tipoCambioProf: string | null;
  };
  variante: ProformaDetalleVariante;
};

// --- Financiero (Contabilidad) ---

export type MonedaCartera = "BS" | "USDT" | "GS" | "CLP" | "USD";
export type NaturalezaMovimiento = "INGRESO" | "GASTO";

export type Cartera = {
  id: string;
  moneda: MonedaCartera;
  nombre: string;
  activo: boolean;
  saldoActual: string;
  createdAt: string;
  updatedAt: string;
};

export type CarteraInput = { moneda?: MonedaCartera; nombre?: string; activo?: boolean };

export type TipoMovimiento = {
  id: string;
  carteraId: string;
  nombre: string;
  naturaleza: NaturalezaMovimiento;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TipoMovimientoInput = { nombre?: string; naturaleza?: NaturalezaMovimiento; activo?: boolean };

/** Tipo de movimiento con los datos de su cartera — lo devuelve el listado global (página Tipos). */
export type TipoMovimientoConCartera = TipoMovimiento & {
  cartera: { id: string; nombre: string; moneda: MonedaCartera };
};

/** total es el saldo acumulado de la cartera hasta esta fila (calculado por el backend, no
 * guardado) — es la columna "Total" del libro de caja. */
export type MovimientoCartera = {
  id: string;
  carteraId: string;
  fecha: string;
  detalle: string;
  naturaleza: NaturalezaMovimiento;
  monto: string;
  total: number;
  tipoMovimiento: { id: string; nombre: string; naturaleza: NaturalezaMovimiento } | null;
  traspaso: {
    id: string;
    carteraOrigen: { id: string; nombre: string };
    carteraDestino: { id: string; nombre: string };
  } | null;
  createdAt: string;
};

export type MovimientoInput = {
  detalle: string;
  naturaleza: NaturalezaMovimiento;
  monto: number;
  tipoMovimientoId: string;
};

/** Movimiento de cartera ligado a una venta de un cliente puntual — adelanto, cobro de Cuenta por
 * Cobrar, o el reverso de un adelanto si se anuló la venta. Ver GET /clientes/:id/pagos. */
export type PagoCliente = {
  id: string;
  fecha: string;
  detalle: string;
  naturaleza: NaturalezaMovimiento;
  monto: string;
  cartera: { id: string; nombre: string; moneda: MonedaCartera };
  proforma: { id: string; codigo: string };
};

export type Traspaso = {
  id: string;
  fecha: string;
  carteraOrigenId: string;
  carteraOrigen: { id: string; nombre: string; moneda: MonedaCartera };
  carteraDestinoId: string;
  carteraDestino: { id: string; nombre: string; moneda: MonedaCartera };
  montoOrigen: string;
  tipoCambio: string;
  montoDestino: string;
  nota: string | null;
  createdAt: string;
};

export type TraspasoInput = {
  carteraOrigenId: string;
  carteraDestinoId: string;
  montoOrigen: number;
  tipoCambio?: number;
  nota?: string;
};
