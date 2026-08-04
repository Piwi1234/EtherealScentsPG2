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

export type ProductVariantOption = {
  attributeId: string;
  optionId: string;
  attribute: Attribute;
  option: AttributeOption;
};

export type ProductVariant = {
  id: string;
  variantCode: string;
  purchasePrice: string;
  utility: string;
  /** Calculado en vivo, misma fórmula que el producto pero con la purchasePrice/utility de la variante. */
  price: number;
  options: ProductVariantOption[];
};

export type Product = {
  id: string;
  name: string;
  productCode: string;
  purchasePrice: string;
  utility: string;
  /** Calculado en vivo por el backend: purchasePrice + logisticsCost + shippingCost + securityCost (de category) + utility. */
  price: number;
  imageUrl: string | null;
  brandId: string | null;
  categoryId: string;
  brand: Brand | null;
  category: Category;
  attributeValues: ProductAttributeValue[];
  variants: ProductVariant[];
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
