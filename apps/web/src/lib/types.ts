export type CarouselImage = {
  id: string;
  categoryId: string | null;
  imageUrl: string;
  // Variante opcional para pantallas chicas — null usa `imageUrl` también en mobile.
  mobileImageUrl: string | null;
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

export type ClienteImportReport = {
  total: number;
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
};

export type BrandNormalizeCasePreviewRow = { id: string; oldName: string; newName: string };

// --- Historias ---

export type HistoriaCategoria = "CASAS" | "PERFUMISTAS" | "INGREDIENTES" | "FRAGANCIAS" | "APRENDE";

export type HistoriaBloque = {
  id: string;
  historiaId: string;
  orden: number;
  texto1: string | null;
  texto2: string | null;
  texto3: string | null;
  texto4: string | null;
  imageUrl: string | null;
  // Variante opcional para pantallas chicas — null usa `imageUrl` también en mobile.
  mobileImageUrl: string | null;
};

// Forma resumida que devuelve el listado (solo la portada, para la miniatura) — a diferencia del
// detalle completo (HistoriaDetalle), que trae todos los bloques.
export type HistoriaResumen = {
  id: string;
  titulo: string;
  slug: string;
  publicada: boolean;
  orden: number;
  categorias: { categoria: HistoriaCategoria }[];
  bloques: HistoriaBloque[];
};

export type HistoriaSugerenciaTipo = "CASA" | "PERFUMES" | "PERFUMISTA" | "INGREDIENTE";

export type HistoriaSugerenciaAttributeOption = {
  id: string;
  value: string;
  color: string | null;
  attribute: { id: string; categoryId: string; category: { slug: string } };
};

export type HistoriaDetalle = HistoriaResumen & {
  relacionadas: { historiaB: HistoriaResumen }[];
  // Imagen propia del bloque "Última historia" del home — null usa la de la portada (bloques[0]).
  homeImageUrl: string | null;
  homeMobileImageUrl: string | null;
  sugerenciaTipo: HistoriaSugerenciaTipo | null;
  // CASA/INGREDIENTE solo traen el id elegido (marca/acorde) — los productos se resuelven en vivo
  // contra /catalog/products del lado del cliente, ver HistoriaDetailClient. PERFUMES trae los ids
  // elegidos a mano, en orden; el Product completo de cada uno también se resuelve en vivo por id.
  sugerenciaBrand: Brand | null;
  sugerenciaAttributeOption: HistoriaSugerenciaAttributeOption | null;
  sugerenciaProductos: { productId: string; orden: number }[];
};

export type ProductImportReport = {
  total: number;
  created: number;
  errors: { row: number; message: string }[];
};

export type ProductVariantImportReport = {
  total: number;
  created: number;
  errors: { row: number; message: string }[];
};

export type ProductImageImportReport = {
  total: number;
  updated: number;
  unmatched: { fileName: string; code: string }[];
  errors: { fileName: string; message: string }[];
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

/** Control de catálogo de una variante (ver ProductVariant.estado). PREVENTA no cuenta como agotado
 * (ver `isSoldOut`) pero queda afuera de "Descuentos"/"Ofertas Flash" del home aunque tenga
 * descuento o temporizador cargado — tiene su propio filtro "Preventa" ahí. */
export type EstadoVariante = "DISPONIBLE" | "NO_DISPONIBLE" | "PREVENTA";

export type AttributeOption = {
  id: string;
  attributeId: string;
  value: string;
  /** Color hex (ej. "#c9a96e") del botón de esta opción en el formulario de producto. */
  color: string | null;
  /** Curaduría manual para el buscador "¿Qué te gusta oler?" del home (ver ScentFinder en
   * home/page.tsx) — independiente de isFilterable/ordenFiltro de Attribute. */
  destacadoHome: boolean;
  ordenDestacado: number;
};

export type Attribute = {
  id: string;
  categoryId: string;
  name: string;
  type: AttributeType;
  isFilterable: boolean;
  /** Posición en el filtro lateral de categoría cuando isFilterable está activo (menor primero). */
  ordenFiltro: number;
  isRequired: boolean;
  /** Si se muestra como columna extra en la tabla de Productos del panel. */
  showInProductList: boolean;
  /** Si se muestra al armar una línea de proforma (ordenado por `orden`). */
  mostrarEnProforma: boolean;
  orden: number;
  /** Si se muestra en la línea de atributos de la tarjeta de producto pública (ordenado por
   * `ordenTarjeta`) — independiente de mostrarEnProforma. */
  mostrarEnTarjeta: boolean;
  ordenTarjeta: number;
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
  /** "Add May" (manual, opcional, campo minPriceBs, EN DÓLARES — se convierte a Bs al tipo de cambio
   * del sistema, ver finalPriceBs) y Descuento Bs (manual, en Bs) propios de esta variante. */
  minPriceBs: string | null;
  discountBs: string;
  /** true = variante "default" auto-provista (catálogo simple); su discountBs queda congelado al
   * crearse, así que no sirve para saber si el producto está en oferta (ver `hasDiscount`). */
  isDefault: boolean;
  /** Calculado en vivo, misma fórmula que el producto pero con la purchasePrice/utility de la variante. */
  price: number;
  /** Calculado en vivo: price * tipo de cambio del sistema. */
  wholesalePriceBs: number;
  /** Calculado en vivo: (wholesalePriceBs + minPriceBs * tipo de cambio) - discountBs. */
  finalPriceBs: number;
  /** Se fija al crear la variante; inmutable después. */
  unidad: UnidadVariante;
  /** Imagen propia de esta variante — solo aplica a unidad=PZA. Si es null, los listados caen al
   * imageUrl del producto. */
  imageUrl: string | null;
  /** Control de catálogo — DISPONIBLE/NO_DISPONIBLE/PREVENTA (ver EstadoVariante). */
  estado: EstadoVariante;
  // Instante UTC hasta el que ESTA variante aparece en "Ofertas Flash". Null = sin temporizador.
  ofertaFlashHasta: string | null;
  // Calculado en vivo por el backend: true si ESTA variante tiene stock disponible (física -
  // reservada > 0). Nunca informa cantidades.
  hasStock: boolean;
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
  /** "Add May" (manual, opcional, campo minPriceBs, EN DÓLARES — se convierte a Bs al tipo de cambio
   * del sistema, ver finalPriceBs) y Descuento Bs (manual, en Bs). Redundantes si hay variantes con
   * precio propio. */
  minPriceBs: string | null;
  discountBs: string;
  /** Calculado en vivo por el backend: purchasePrice + logisticsCost + shippingCost + securityCost (de category) + utility. */
  price: number;
  /** Calculado en vivo: price * tipo de cambio del sistema (Precio May Bs). */
  wholesalePriceBs: number;
  /** Calculado en vivo: (wholesalePriceBs + minPriceBs * tipo de cambio) - discountBs (Precio Final Bs). */
  finalPriceBs: number;
  imageUrl: string | null;
  brandId: string | null;
  categoryId: string;
  brand: Brand | null;
  category: Category;
  attributeValues: ProductAttributeValue[];
  variantOptionValues: ProductVariantOptionValue[];
  variants: ProductVariant[];
  // Instante UTC hasta el que el producto aparece en "Ofertas Flash" del home. Null = sin temporizador.
  ofertaFlashHasta: string | null;
  // Calculado en vivo por el backend: true si alguna variante (incluidas las de precio propio) tiene
  // stock disponible (física - reservada > 0). Nunca informa cantidades.
  hasStock: boolean;
  // Solo poblados por /products (panel admin) — suma de TODAS las variantes y almacenes. El catálogo
  // público (/catalog/products) no los trae, ahí solo importa hasStock (sin cantidades).
  stockDisponible: number;
  stockReservado: number;
  createdAt: string;
};

/** Un acorde del perfume de referencia en /comparar/[slug] — ver GET /catalog/products/:id/similares. */
export type AccordInfo = { id: string; name: string; color: string | null };

/** Respuesta de GET /catalog/products/:id/similares: perfumes que comparten 2+ acordes con el
 * producto, agrupados por cantidad de coincidencias (descendente). */
export type SimilarByAccordsResponse = {
  accords: AccordInfo[];
  totalAccords: number;
  groups: { matchCount: number; items: Product[] }[];
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

/** Datos del bloque "Contacto" del footer del sitio público (Configuración → Global → Contacto). */
export type ContactoInfo = {
  // Números individuales — cada uno se muestra en el footer con whatsappLogoUrl al lado, como link
  // a wa.me.
  telefonos: string[];
  whatsappLogoUrl: string | null;
  email: string | null;
  ciudad: string | null;
  // A dónde redirige el botón "Canal de ofertas" de la sección Newsletter del home.
  canalOfertasUrl: string | null;
};

/** Red social mostrada en el footer (solo se muestra el logo, sin el nombre). */
export type RedSocial = {
  id: string;
  nombre: string;
  url: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

// --- Dashboard (Gestión → Dashboard) ---

export type DashMesTotal = { mes: string; total: number };
export type DashCategoriaTotal = { categoriaId?: string; categoria: string; total: number };
export type DashClienteTotal = { cliente: string; total: number };
export type DashMargenMes = { mes: string; ingresos: number; costos: number; margen: number };
export type DashProveedorCategoriaTotal = { proveedor: string; categoria: string; total: number };
export type DashStockValorizado = { disponibleBs: number; reservadoBs: number };
export type DashSaldoCartera = { id: string; nombre: string; moneda: MonedaCartera; saldo: number };
export type DashIngresoEgresoCartera = {
  carteraId: string;
  cartera: string;
  moneda: MonedaCartera;
  mes: string;
  ingresos: number;
  egresos: number;
};
export type DashCuentasPorCobrar = { totalBs: number; cantidad: number };

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

/** GET /catalog/categories/:categoryId/aggregates — conteos del sidebar de filtros de la categoría
 * (ella + sus subcategorías), calculados sobre el total real, no sobre una tanda paginada. */
export type CategoryAggregates = {
  subcategoryCounts: Record<string, number>;
  brands: { id: string; name: string; count: number }[];
  discountCount: number;
  flashCount: number;
  preventaCount: number;
  inStockCount: number;
  maxPriceBs: number;
};

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
/** MANUAL: cargado desde gestión. WEB: registro propio del cliente (todavía no implementado). */
export type OrigenCliente = "MANUAL" | "WEB";

export type Cliente = {
  id: string;
  tipo: TipoCliente;
  nombre: string;
  email: string | null;
  telefono: string | null;
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
  email?: string;
  telefono?: string;
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
  /** Se preselecciona siempre que el sistema pide un almacén (a lo sumo uno). */
  predeterminado: boolean;
  createdAt: string;
  updatedAt: string;
};

// --- Proformas ---

export type TipoProforma = "COMPRA" | "VENTA";
export type EstadoProforma = "BORRADOR" | "APROBADA" | "COMPLETADA" | "ANULADA";
export type OrigenAsignacion = "STOCK" | "PROCURA" | "EN_TRANSITO";
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
  /** Unidades "para stock" que viajan en envíos ya despachados (todavía no son físicas). */
  cantidadEnTransito: number;
  cantidadReservadaTransito: number;
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
  /** COMPRA: a quién se le compra ESTA línea puntual — una misma proforma puede traer productos de
   * varios proveedores distintos, cada línea el suyo. Null en líneas de venta. */
  proveedorId: string | null;
  proveedor: Proveedor | null;
  /** COMPRA (en desuso): antes distinguía stock de pedido; hoy lo no ligado a ventas es stock. */
  destino?: DestinoCompra;
  /** COMPRA: unidades de la línea ligadas a faltantes de notas de venta. */
  asignacionesCubiertas?: { cantidad: number }[];
  /** COMPRA: unidades de la línea ligadas a líneas de solicitudes de stock. */
  solicitudesCubiertas?: { cantidad: number }[];
  /** COMPRA: lo recogido de esta línea, recojo por recojo. */
  recojoLineas?: { cantidad: number }[];
  subtotal: string;
  asignaciones: ProformaDetalleAsignacion[];
  loteCompras: LoteCompra[];
  createdAt: string;
  updatedAt: string;
};

export type Proforma = {
  id: string;
  /** Solo compras: proveedor de la nota (null en compras viejas que mezclaban proveedores línea por línea). */
  proveedorId?: string | null;
  proveedor?: { id: string; nombre: string } | null;
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
  /** Solo COMPRA: el tipo de cambio propio de ESTA compra puntual, para valorar en Bs sin depender
   * del tipo de cambio del sistema — único para todo el documento (no por línea). Null en VENTA.
   * El proveedor y el país de procedencia ya no son del documento: son por línea, ver
   * ProformaDetalle.proveedorId. */
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
  /** Total de la venta, fijo desde que se aprueba. */
  montoTotal: string;
  /** Lo que falta cobrar. */
  montoAdeudado: string;
  estado: EstadoCuentaPorCobrar;
  createdAt: string;
  updatedAt: string;
};

/** La misma fila, pero con la proforma que la originó — así vienen el listado y el cobro del gestor
 * de Cuentas por Cobrar (GET/POST /contabilidad/cuentas-por-cobrar). La que cuelga embebida de
 * Proforma.cuentaPorCobrar es la versión sin este campo (evita el ciclo proforma → cuenta → proforma). */
export type CuentaPorCobrarConProforma = CuentaPorCobrar & {
  proforma: { id: string; codigo: string; estado: EstadoProforma; fecha: string; cliente: { id: string; nombre: string } | null };
};

/** GET /proformas/:id/pagos: lo cobrado de una venta y los movimientos de cartera ligados. */
export type PagoMovimiento = {
  id: string;
  fecha: string;
  detalle: string;
  naturaleza: "INGRESO" | "GASTO";
  monto: string;
  cartera: { id: string; nombre: string; moneda: string };
  creadoPor: { id: string; nombre: string };
};

export type PagosVenta = {
  total: number;
  montoAdelanto: number;
  adelantoPendiente: number;
  pagado: number;
  saldo: number;
  movimientos: PagoMovimiento[];
};

/** GET /dashboard/pendientes: lo que está esperando una acción. */
export type DashPendientes = {
  pedidosSinCompra: number;
  enviosEnTransito: number;
  piezasEnTransito: number;
  enviosArmando: number;
  borradoresVenta: number;
  borradoresCompra: number;
  diasBorradorMasViejo: number;
  /** Ventas aprobadas con todo reservado en stock físico (se pueden completar). */
  ventasListas: number;
  /** Ventas aprobadas con faltante o reservas en tránsito sin llegar. */
  ventasEsperando: number;
  /** Compras aprobadas que todavía no están en ningún envío. */
  comprasSinEnvio: number;
  /** Ventas con faltante sin compra ligada para las que ya hay stock libre sin reservar. */
  ventasConStockLibre: number;
  /** Líneas de solicitudes de stock abiertas que todavía no tienen compra. */
  solicitudesSinComprar: number;
};

export type ProformaInput = {
  tipo: TipoProforma;
  empresaId: string;
  proveedorId?: string;
  clienteId?: string;
  ciudadEntregaId?: string;
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
  proveedorId?: string;
};

export type UpdateDetalleInput = {
  cantidad?: number;
  precioUnitario?: number;
  precioCompra?: number;
  costoEnvio?: number;
  costoSeguridad?: number;
  costoLogistica?: number;
  proveedorId?: string;
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
  /** Derivado de la compra/envío ligados (ya no es una etiqueta manual). */
  estadoPedido: EstadoPedido;
  /** Unidades de este faltante que ya se recogieron del proveedor. */
  recogidas?: number;
  /** Unidades de este faltante que ya salieron en un envío. */
  enviadas?: number;
  proformaDetalle: {
    proforma: {
      id: string;
      codigo: string;
      fecha: string;
      empresa: { id: string; nombre: string };
      cliente: { id: string; nombre: string } | null;
    };
    variante: ProformaDetalleVariante;
  };
  /** La línea de compra que viene a cubrir este faltante, si hay una ligada. */
  compraDetalle: {
    id: string;
    cantidad: number;
    proveedor: { id: string; nombre: string } | null;
    proforma: { id: string; codigo: string; estado: EstadoProforma };
    envioItems?: { cantidad: number; envio: { id: string; codigo: string; estado: EstadoEnvio } }[];
  } | null;
};

export type DestinoCompra = "STOCK" | "PEDIDO";

// --- Recojos ---

export type Recojo = {
  id: string;
  fecha: string;
  nota: string | null;
  creadoPor: { id: string; nombre: string };
  lineas: { id: string; cantidad: number; compraDetalle: { id: string; variante: { id: string; variantCode: string; product: { name: string; brand: { name: string } | null } } } }[];
};

export type RecojosCompra = {
  recojos: Recojo[];
  /** Por línea de la compra: comprado, recogido y lo que falta por recoger. */
  resumen: { compraDetalleId: string; cantidad: number; recogido: number; porRecoger: number }[];
};

// --- Solicitudes de stock ---

/** Estado derivado de una línea de solicitud según la compra/envío que la cubre (RECIBIDA: la compra ya llegó). */
export type EstadoLineaSolicitud = EstadoPedido | "RECIBIDA";

export type SolicitudLinea = {
  id: string;
  cantidad: number;
  nota: string | null;
  compraDetalleId: string | null;
  estadoLinea: EstadoLineaSolicitud;
  /** Unidades de esta línea que ya se recogieron del proveedor. */
  recogidas?: number;
  /** Unidades de esta línea que ya salieron en un envío. */
  enviadas?: number;
  /** Unidades de esta línea que ya llegaron al almacén. */
  cantidadRecibida: number;
  variante: ProformaDetalleVariante;
  compraDetalle: {
    id: string;
    cantidad: number;
    proveedor: { id: string; nombre: string } | null;
    proforma: { id: string; codigo: string; estado: EstadoProforma };
    envioItems?: { cantidad: number; envio: { id: string; codigo: string; estado: EstadoEnvio } }[];
  } | null;
};

export type SolicitudStock = {
  id: string;
  codigo: string;
  nota: string | null;
  estado: "ABIERTA" | "CANCELADA";
  estadoDerivado: "ABIERTA" | "CERRADA" | "CANCELADA";
  createdAt: string;
  creadoPor: { id: string; nombre: string };
  lineas: SolicitudLinea[];
};

/** Línea de solicitud vista desde Seguimiento (lleva su solicitud). */
export type SolicitudLineaSeguimiento = SolicitudLinea & {
  solicitud: { id: string; codigo: string; nota: string | null; createdAt: string; creadoPor: { id: string; nombre: string } };
};

/** Línea de solicitud que una línea de compra puede cubrir (GET .../compra/:id/solicitudes). */
export type SolicitudLineaParaCompra = {
  id: string;
  cantidad: number;
  compraDetalleId: string | null;
  solicitud: { id: string; codigo: string; creadoPor: { id: string; nombre: string } };
};

export type PendientesPorVariante = {
  pedidos: { id: string; varianteId: string; cantidad: number; codigo: string }[];
  stock: { id: string; varianteId: string; cantidad: number; codigo: string }[];
};

/** POST /proformas/seguimiento/crear-compras: un grupo por proveedor, con las líneas y los faltantes que cubre. */
export type CrearComprasInput = {
  grupos: {
    proveedorId: string;
    lineas: { varianteId: string; asignacionIds: string[]; solicitudLineaIds?: string[]; cantidadExtra?: number }[];
  }[];
};

export type CompraCreada = {
  id: string;
  codigo: string;
  proveedor: { id: string; nombre: string } | null;
  lineas: number;
  unidades: number;
};

/** SIN_COMPRA: nada ligado (o la compra ligada ya cerró sin cubrirlo). */
export type EstadoPedido = "SIN_COMPRA" | "EN_PREPARACION" | "COMPRADO" | "RECOGIDO" | "EN_TRANSITO";

/** Una línea de compra "para stock" ya aprobada y todavía sin recibir (vista "Stock pedido"). */
export type SeguimientoStockLinea = {
  id: string;
  cantidad: number;
  estadoStock: "COMPRADO" | "RECOGIDO" | "EN_TRANSITO";
  /** Unidades libres (para stock) de esta línea que ya se recogieron. */
  recogidas?: number;
  proveedor: { id: string; nombre: string } | null;
  proforma: {
    id: string;
    codigo: string;
    fecha: string;
    empresa: { id: string; nombre: string };
  };
  /** Envíos despachados en los que viaja esta línea. */
  envios: { id: string; codigo: string; estado: EstadoEnvio }[];
  variante: ProformaDetalleVariante;
};

/** Línea de compra (pedido) a la que se puede ligar un faltante, con cuánto le queda por cubrir. */
export type CompraCandidata = {
  id: string;
  cantidad: number;
  restante: number;
  proveedor: { id: string; nombre: string } | null;
  proforma: { id: string; codigo: string; estado: EstadoProforma };
};

/** Faltante de una nota de venta aprobada que una línea de compra puede cubrir. */
export type ProcuraCandidata = {
  id: string;
  cantidad: number;
  compraDetalleId: string | null;
  proformaDetalle: {
    proforma: { id: string; codigo: string; fecha: string; cliente: { id: string; nombre: string } | null };
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
  /** COMPRA: a quién se le compra ESTA línea puntual. Null en líneas de venta. */
  proveedor: { id: string; nombre: string; paisProcedencia: { id: string; nombre: string } | null } | null;
  proforma: {
    id: string;
    codigo: string;
    estado: EstadoProforma;
    fecha: string;
    createdAt: string;
    creadoPor: { id: string; nombre: string };
    /** Última anulación (vacío si no está anulada): cuándo, quién y el motivo. */
    historial: { fecha: string; nota: string | null; usuario: { id: string; nombre: string } }[];
    empresa: { id: string; nombre: string };
    cliente: { id: string; nombre: string } | null;
    tipoCambioProf: string | null;
  };
  variante: ProformaDetalleVariante;
};

/** Totales de TODO el filtro de Registros (no solo de la página visible). */
export type RegistroResumen = {
  totalBs: number;
  piezas: number;
  proformas: number;
  /** Monto en Bs y cantidad de proformas por estado dentro del filtro. */
  porEstado: Partial<Record<EstadoProforma, { totalBs: number; proformas: number }>>;
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

// --- Envíos (agrupan productos ya recogidos; la recepción puede ser parcial) ---

export type EstadoEnvio = "ARMANDO" | "EN_TRANSITO" | "RECIBIDO" | "ANULADO";

export type EnvioVariante = {
  id: string;
  variantCode: string;
  unidad: UnidadVariante;
  product: { id: string; name: string; productCode: string; brand: { id: string; name: string } | null };
  options: { optionValue: { value: string; attribute: { name: string } } }[];
};

/** Un producto recogido (parte de una línea de compra) que viaja en el envío. */
export type EnvioItem = {
  id: string;
  envioId: string;
  compraDetalleId: string;
  cantidad: number;
  cantidadRecibida: number;
  compraDetalle: {
    id: string;
    cantidad: number;
    proveedor: { id: string; nombre: string } | null;
    proforma: { id: string; codigo: string; estado: EstadoProforma };
    variante: EnvioVariante;
  };
};

/** Un evento de recepción: lo que llegó en esa fecha (puede ser parte del envío). */
export type EnvioRecepcion = {
  id: string;
  fecha: string;
  nota: string | null;
  creadoPor: { id: string; nombre: string };
  items: { id: string; cantidad: number; nota: string | null; varianteRecibidaId: string; varianteRecibida: EnvioVariante; envioItem: { id: string; compraDetalleId: string } }[];
};

export type Envio = {
  id: string;
  codigo: string;
  estado: EstadoEnvio;
  almacenDestinoId: string;
  almacenDestino: Almacen;
  nota: string | null;
  fechaEnvio: string | null;
  fechaRecepcion: string | null;
  creadoPor: { id: string; nombre: string };
  createdAt: string;
  items: EnvioItem[];
  recepciones: EnvioRecepcion[];
};

/** Fila del listado: solo cantidades y códigos de las compras que viajan. */
export type EnvioResumen = Omit<Envio, "items" | "recepciones"> & {
  items: { cantidad: number; cantidadRecibida: number; compraDetalle: { proforma: { id: string; codigo: string } } }[];
};

/** Línea de compra con unidades ya recogidas que todavía se pueden sumar a un envío. */
export type EnvioDisponible = {
  id: string;
  cantidad: number;
  recogido: number;
  disponible: number;
  proveedor: { id: string; nombre: string } | null;
  proforma: { id: string; codigo: string; fecha: string; proveedor: { id: string; nombre: string } | null };
  variante: EnvioVariante;
};

export type CreateEnvioInput = { almacenDestinoId: string; nota?: string; items?: { compraDetalleId: string; cantidad: number }[] };
export type CreateRecepcionInput = {
  nota?: string;
  items: { envioItemId: string; cantidad: number; varianteRecibidaId?: string; nota?: string }[];
};
