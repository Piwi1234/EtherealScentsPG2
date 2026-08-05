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
