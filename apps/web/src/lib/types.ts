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

export type Product = {
  id: string;
  name: string;
  productCode: string;
  purchasePrice: string;
  utility: string;
  /** Calculado en vivo por el backend: purchasePrice + logisticsCost + shippingCost + securityCost (de category) + utility. */
  price: number;
  brandId: string | null;
  categoryId: string;
  brand: Brand | null;
  category: Category;
  attributeValues: ProductAttributeValue[];
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
