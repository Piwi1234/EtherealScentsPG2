"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  API_ORIGIN,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiUpload,
  ApiError,
  createPresentacion,
  getPresentaciones,
  updatePresentacion,
} from "../../../lib/api";
import { consumeFlashMessage, setFlashMessage } from "../../../lib/flash";
import type {
  Attribute,
  Brand,
  Category,
  ExchangeRateResponse,
  PresentacionVenta,
  Product,
  ProductVariant,
  UnidadVariante,
} from "../../../lib/types";
import { Modal } from "../../../components/Modal";

function productImageSrc(imageUrl: string | null): string | null {
  return imageUrl ? `${API_ORIGIN}${imageUrl}` : null;
}

/** Precio Final Bs siempre se redondea hacia arriba al múltiplo de 10 más cercano. Misma regla que el backend. */
function roundUpToTen(value: number): number {
  return Math.ceil(value / 10) * 10;
}

// Oferta Flash: el admin siempre carga la hora en GMT-4 (la zona horaria de la tienda), sin importar
// en qué huso esté su propia computadora — se convierte a UTC acá mismo, antes de mandarlo al backend.
const GMT4_OFFSET_MS = 4 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** dateStr "YYYY-MM-DD" + timeStr "HH:mm" (hora de pared en GMT-4) -> instante UTC en ISO. */
function gmt4ToUtcIso(dateStr: string, timeStr: string, seconds = 0): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  // Date.UTC toma los componentes tal cual (como si fueran UTC); sumar el offset de GMT-4 corrige
  // eso para que el resultado sea el instante UTC real que corresponde a esa hora de pared.
  return new Date(Date.UTC(y, m - 1, d, hh, mm, seconds) + GMT4_OFFSET_MS).toISOString();
}

/** Instante UTC en ISO -> { date, time } de su hora de pared equivalente en GMT-4 (para precargar el form). */
function utcIsoToGmt4Parts(iso: string): { date: string; time: string } {
  const gmt4Ms = new Date(iso).getTime() - GMT4_OFFSET_MS;
  const d = new Date(gmt4Ms);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

type VariantFormState = {
  optionsByAttribute: Record<string, string>;
  purchasePrice: string;
  utility: string;
  minPriceBs: string;
  discountBs: string;
  unidad: UnidadVariante;
};

const EMPTY_VARIANT_FORM: VariantFormState = {
  optionsByAttribute: {},
  purchasePrice: "",
  utility: "0",
  minPriceBs: "",
  discountBs: "0",
  unidad: "PZA",
};

export function ProductForm({ initialProduct }: { initialProduct?: Product }) {
  const router = useRouter();
  const editing = initialProduct ?? null;

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [name, setName] = useState(editing?.name ?? "");
  const [brandId, setBrandId] = useState(editing?.brandId ?? "");
  // Selección en 2 pasos: categoría raíz y, si tiene, subcategoría. `categoryId` es la que
  // efectivamente se guarda en el producto (la subcategoría, o la raíz si no tiene hijas).
  const [rootCategoryId, setRootCategoryId] = useState(editing ? editing.category.parentId ?? editing.category.id : "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [purchasePrice, setPurchasePrice] = useState(editing?.purchasePrice ?? "");
  const [utility, setUtility] = useState(editing?.utility ?? "0");
  const [minPriceBs, setMinPriceBs] = useState(editing?.minPriceBs ?? "");
  const [discountBs, setDiscountBs] = useState(editing?.discountBs ?? "0");
  // Oferta Flash: "endOfDay" y "exact" son solo del formulario (no se guardan como tales) — al
  // editar, si la hora de pared en GMT-4 guardada es 23:59 se asume "endOfDay", si no "exact".
  const initialFlashParts = editing?.ofertaFlashHasta ? utcIsoToGmt4Parts(editing.ofertaFlashHasta) : null;
  const [flashMode, setFlashMode] = useState<"none" | "exact" | "endOfDay">(
    !initialFlashParts ? "none" : initialFlashParts.time === "23:59" ? "endOfDay" : "exact",
  );
  const [flashDate, setFlashDate] = useState(initialFlashParts?.date ?? "");
  const [flashTime, setFlashTime] = useState(initialFlashParts?.time ?? "20:00");
  const [exchangeRate, setExchangeRate] = useState(0);
  const [attributeDefs, setAttributeDefs] = useState<Attribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  // Atributos SELECT normales con allowMultiple (ej. Acordes): el producto elige 1+ opciones de la
  // lista compartida de la categoría. Botones coloreados, no un <select>.
  const [multiSelectValues, setMultiSelectValues] = useState<Record<string, Set<string>>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(productImageSrc(editing?.imageUrl ?? null));
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flashMessage, setLocalFlashMessage] = useState<string | null>(null);

  const [currentProduct, setCurrentProduct] = useState<Product | null>(editing);
  const [variantForm, setVariantForm] = useState<VariantFormState>(EMPTY_VARIANT_FORM);
  const [variantError, setVariantError] = useState("");
  const [variantSubmitting, setVariantSubmitting] = useState(false);
  const [variantRowError, setVariantRowError] = useState<Record<string, string>>({});

  // Valores propios del producto para atributos MULTI_VALUE ("Sabor") y PRICED_VARIANT ("Tamaño"):
  // inputs de "agregar valor" (por atributo) y su error, separados por sección.
  const [newMultiValue, setNewMultiValue] = useState<Record<string, string>>({});
  const [multiValueError, setMultiValueError] = useState("");
  const [newVariantValue, setNewVariantValue] = useState<Record<string, string>>({});
  const [variantValueError, setVariantValueError] = useState("");

  // Presentaciones (subvariantes) de una variante ML — se gestionan en un modal aparte, por variante.
  const [presentacionesVarianteId, setPresentacionesVarianteId] = useState<string | null>(null);
  const [presentaciones, setPresentaciones] = useState<PresentacionVenta[]>([]);
  const [nuevaCantidadMl, setNuevaCantidadMl] = useState("");
  const [nuevoPrecioBs, setNuevoPrecioBs] = useState("");
  const [presentacionError, setPresentacionError] = useState("");
  const [presentacionSubmitting, setPresentacionSubmitting] = useState(false);

  // Oferta Flash por variante (categorías con precio propio) — se edita en un modal aparte, por
  // variante, igual que Presentaciones arriba.
  const [flashModalVariantId, setFlashModalVariantId] = useState<string | null>(null);
  const [variantFlashMode, setVariantFlashMode] = useState<"none" | "exact" | "endOfDay">("none");
  const [variantFlashDate, setVariantFlashDate] = useState("");
  const [variantFlashTime, setVariantFlashTime] = useState("20:00");
  const [variantFlashError, setVariantFlashError] = useState("");
  const [variantFlashSubmitting, setVariantFlashSubmitting] = useState(false);

  const rootCategoryOptions = categories.filter((cat) => cat.parentId === null);
  const subCategoryOptions = categories.filter((cat) => cat.parentId === rootCategoryId);

  // Las marcas solo se asignan a subcategorías (nunca a categorías raíz). Si ya se eligió una
  // subcategoría puntual, se filtra por esa; si solo hay categoría raíz, por cualquiera de sus
  // subcategorías.
  const isSubCategorySelected = Boolean(categoryId) && categoryId !== rootCategoryId;
  const relevantCategoryIdsForBrands = isSubCategorySelected ? [categoryId] : subCategoryOptions.map((cat) => cat.id);
  const availableBrands = rootCategoryId
    ? brands.filter((brand) => brand.categories.some((bc) => relevantCategoryIdsForBrands.includes(bc.categoryId)))
    : [];

  // Atributos normales (un valor), múltiples sin precio (ej. sabores) y con precio propio (ej. tamaño).
  const regularAttrs = attributeDefs.filter((def) => def.variantMode === "NONE");
  const multiValueAttrs = attributeDefs.filter((def) => def.variantMode === "MULTI_VALUE");
  const pricedVariantAttrs = attributeDefs.filter((def) => def.variantMode === "PRICED_VARIANT");
  const hasAttributes = regularAttrs.length > 0 || multiValueAttrs.length > 0 || pricedVariantAttrs.length > 0;

  useEffect(() => {
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    apiGet<Brand[]>("/brands").then(setBrands).catch(() => {});
    apiGet<ExchangeRateResponse>("/settings/exchange-rate").then((data) => setExchangeRate(data.exchangeRate)).catch(() => {});
  }, []);

  // Si venimos de crear un producto con variantes con precio propio (se redirige acá mismo, a
  // editar, para poder cargarlas de una), mostramos el mensaje de éxito pendiente.
  useEffect(() => {
    const message = consumeFlashMessage();
    if (!message) return;
    setLocalFlashMessage(message);
    const timeout = setTimeout(() => setLocalFlashMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, []);

  async function loadAttributesFor(id: string): Promise<Attribute[]> {
    if (!id) {
      setAttributeDefs([]);
      return [];
    }
    const attrs = await apiGet<Attribute[]>(`/categories/${id}/attributes`);
    setAttributeDefs(attrs);
    return attrs;
  }

  // Carga inicial (modo edición): atributos de la categoría del producto + valores ya guardados.
  // Los MULTI_VALUE/PRICED_VARIANT no pasan por acá: viven en editing.variantOptionValues, que ya
  // está embebido en `currentProduct` desde el arranque.
  useEffect(() => {
    if (!editing) return;
    loadAttributesFor(editing.categoryId).then(() => {
      const values: Record<string, string> = {};
      const multiSelect: Record<string, Set<string>> = {};
      for (const pv of editing.attributeValues) {
        if (pv.attribute.allowMultiple) {
          if (pv.optionId) {
            const set = multiSelect[pv.attributeId] ?? new Set<string>();
            set.add(pv.optionId);
            multiSelect[pv.attributeId] = set;
          }
          continue;
        }
        if (pv.optionId) values[pv.attributeId] = pv.optionId;
        else if (pv.valueText !== null) values[pv.attributeId] = pv.valueText;
        else if (pv.valueNumber !== null) values[pv.attributeId] = pv.valueNumber;
        else if (pv.valueBoolean !== null) values[pv.attributeId] = String(pv.valueBoolean);
      }
      setAttributeValues(values);
      setMultiSelectValues(multiSelect);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  function handleImageSelect(file: File | null) {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : productImageSrc(editing?.imageUrl ?? null));
  }

  function toggleMultiSelectValue(attributeId: string, optionId: string) {
    setMultiSelectValues((prev) => {
      const next = new Set(prev[attributeId] ?? []);
      next.has(optionId) ? next.delete(optionId) : next.add(optionId);
      return { ...prev, [attributeId]: next };
    });
  }

  async function handleRootCategoryChange(id: string) {
    setRootCategoryId(id);
    setAttributeValues({});
    setMultiSelectValues({});
    setVariantForm(EMPTY_VARIANT_FORM);
    setNewMultiValue({});
    setNewVariantValue({});
    setBrandId("");
    const children = categories.filter((cat) => cat.parentId === id);
    if (children.length === 0) {
      // Categoría raíz sin subcategorías: se usa directamente.
      setCategoryId(id);
      await loadAttributesFor(id);
    } else {
      setCategoryId("");
      setAttributeDefs([]);
    }
  }

  async function handleSubCategoryChange(id: string) {
    setCategoryId(id);
    setAttributeValues({});
    setMultiSelectValues({});
    setVariantForm(EMPTY_VARIANT_FORM);
    setNewMultiValue({});
    setNewVariantValue({});
    setBrandId("");
    await loadAttributesFor(id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!categoryId) {
      setFormError("Elegí una categoría (y subcategoría, si corresponde).");
      return;
    }

    const missing = regularAttrs
      .filter((def) => !def.allowMultiple)
      .filter((def) => def.isRequired && !attributeValues[def.id]);
    const missingMultiSelect = regularAttrs
      .filter((def) => def.allowMultiple)
      .filter((def) => def.isRequired && !(multiSelectValues[def.id]?.size));
    if (missing.length > 0 || missingMultiSelect.length > 0) {
      setFormError(`Falta completar: ${[...missing, ...missingMultiSelect].map((m) => m.name).join(", ")}`);
      return;
    }

    if (pricedVariantAttrs.length === 0 && flashMode !== "none" && !flashDate) {
      setFormError("Elegí una fecha para la Oferta Flash (o quitale el temporizador).");
      return;
    }
    if (pricedVariantAttrs.length === 0 && flashMode === "exact" && !flashTime) {
      setFormError("Elegí una hora para la Oferta Flash.");
      return;
    }

    setSubmitting(true);
    try {
      const regularPayload = regularAttrs
        .filter((def) => !def.allowMultiple)
        .filter((def) => attributeValues[def.id])
        .map((def) => {
          const raw = attributeValues[def.id];
          if (def.type === "SELECT") return { attributeId: def.id, optionId: raw };
          if (def.type === "NUMBER") return { attributeId: def.id, valueNumber: Number(raw) };
          if (def.type === "BOOLEAN") return { attributeId: def.id, valueBoolean: raw === "true" };
          return { attributeId: def.id, valueText: raw };
        });
      const multiSelectPayload = regularAttrs
        .filter((def) => def.allowMultiple)
        .flatMap((def) => Array.from(multiSelectValues[def.id] ?? []).map((optionId) => ({ attributeId: def.id, optionId })));

      // Si la categoría tiene atributos con precio propio, el precio (tanto $ como Bs) se carga por
      // variante: pedirlo acá también sería redundante. Ojo: hay que OMITIR purchasePrice (no mandar
      // 0), porque el backend lo valida como número positivo cuando el campo está presente.
      const usesPricedVariants = pricedVariantAttrs.length > 0;
      // Igual que purchasePrice/discountBs: si la categoría tiene variantes con precio propio, la
      // Oferta Flash se carga por variante (tabla de arriba) y este campo del producto no aplica.
      const ofertaFlashHasta = usesPricedVariants
        ? undefined
        : flashMode === "none"
          ? null
          : flashMode === "endOfDay"
            ? gmt4ToUtcIso(flashDate, "23:59", 59)
            : gmt4ToUtcIso(flashDate, flashTime);
      const payload = {
        name,
        purchasePrice: usesPricedVariants ? undefined : Number(purchasePrice),
        utility: usesPricedVariants ? undefined : Number(utility || 0),
        minPriceBs: usesPricedVariants || !minPriceBs ? undefined : Number(minPriceBs),
        discountBs: usesPricedVariants ? undefined : Number(discountBs || 0),
        brandId: brandId || undefined,
        categoryId,
        attributeValues: [...regularPayload, ...multiSelectPayload],
        ofertaFlashHasta,
      };

      const saved = editing
        ? await apiPatch<Product>(`/products/${editing.id}`, payload)
        : await apiPost<Product>("/products", payload);

      if (imageFile) {
        await apiUpload(`/products/${saved.id}/image`, imageFile);
      }

      setFlashMessage(editing ? "Producto editado correctamente." : "Producto creado correctamente.");

      // Si el producto usa atributos con variante (múltiple o con precio propio) y recién se creó,
      // seguimos en la edición para poder cargarle sus propios valores de una: esos valores necesitan
      // que el producto ya exista, así que si volviéramos al listado, habría que volver a entrar a mano.
      const usesVariants = usesPricedVariants || multiValueAttrs.length > 0;
      if (usesVariants && !editing) {
        router.push(`/dashboard/products/${saved.id}/edit`);
      } else {
        router.push("/dashboard/products");
      }
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  /** Agrega un valor propio del producto (sabor, tamaño, etc.) para un atributo con variante. */
  async function handleAddVariantValue(attributeId: string, rawValue: string, onSuccess: () => void, setError: (msg: string) => void) {
    if (!currentProduct || !rawValue.trim()) return;
    setError("");
    try {
      const updated = await apiPost<Product>(`/products/${currentProduct.id}/variant-options`, {
        attributeId,
        value: rawValue.trim(),
      });
      setCurrentProduct(updated);
      onSuccess();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRemoveVariantValue(optionValueId: string, setError: (msg: string) => void) {
    if (!currentProduct) return;
    setError("");
    try {
      await apiDelete(`/products/${currentProduct.id}/variant-options/${optionValueId}`);
      const updated = await apiGet<Product>(`/products/${currentProduct.id}`);
      setCurrentProduct(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  async function handleAddVariant() {
    if (!currentProduct) return;
    setVariantError("");

    const optionValueIds = pricedVariantAttrs
      .filter((def) => variantForm.optionsByAttribute[def.id])
      .map((def) => variantForm.optionsByAttribute[def.id]);
    if (optionValueIds.length === 0) {
      setVariantError("Elegí al menos un valor para la variante.");
      return;
    }
    if (!variantForm.purchasePrice) {
      setVariantError("Ingresá el precio de compra de la variante.");
      return;
    }

    setVariantSubmitting(true);
    try {
      const updated = await apiPost<Product>(`/products/${currentProduct.id}/variants`, {
        purchasePrice: Number(variantForm.purchasePrice),
        utility: Number(variantForm.utility || 0),
        minPriceBs: variantForm.minPriceBs ? Number(variantForm.minPriceBs) : undefined,
        discountBs: Number(variantForm.discountBs || 0),
        unidad: variantForm.unidad,
        optionValueIds,
      });
      setCurrentProduct(updated);
      setVariantForm(EMPTY_VARIANT_FORM);
    } catch (e) {
      setVariantError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setVariantSubmitting(false);
    }
  }

  async function handleDeleteVariant(variantId: string) {
    if (!currentProduct || !confirm("¿Eliminar esta variante?")) return;
    try {
      await apiDelete(`/products/${currentProduct.id}/variants/${variantId}`);
      const updated = await apiGet<Product>(`/products/${currentProduct.id}`);
      setCurrentProduct(updated);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  /** Precio de compra/Utilidad/Add May/Descuento editables sin recrear la variante — cada campo su propio PATCH. */
  async function handleUpdateVariantField(
    variantId: string,
    field: "purchasePrice" | "utility" | "minPriceBs" | "discountBs",
    raw: string,
  ) {
    if (!currentProduct) return;
    const value = Number(raw);
    if (Number.isNaN(value)) return;
    setVariantRowError((prev) => ({ ...prev, [variantId]: "" }));
    try {
      const updated = await apiPatch<Product>(`/products/${currentProduct.id}/variants/${variantId}`, { [field]: value });
      setCurrentProduct(updated);
    } catch (e) {
      setVariantRowError((prev) => ({
        ...prev,
        [variantId]: e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e),
      }));
    }
  }

  async function handleUpdateVariantDisponible(variantId: string, disponible: boolean) {
    if (!currentProduct) return;
    setVariantRowError((prev) => ({ ...prev, [variantId]: "" }));
    try {
      const updated = await apiPatch<Product>(`/products/${currentProduct.id}/variants/${variantId}`, { disponible });
      setCurrentProduct(updated);
    } catch (e) {
      setVariantRowError((prev) => ({
        ...prev,
        [variantId]: e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e),
      }));
    }
  }

  function openVariantFlashModal(variant: ProductVariant) {
    const parts = variant.ofertaFlashHasta ? utcIsoToGmt4Parts(variant.ofertaFlashHasta) : null;
    setFlashModalVariantId(variant.id);
    setVariantFlashMode(!parts ? "none" : parts.time === "23:59" ? "endOfDay" : "exact");
    setVariantFlashDate(parts?.date ?? "");
    setVariantFlashTime(parts?.time ?? "20:00");
    setVariantFlashError("");
  }

  async function handleSaveVariantFlash() {
    if (!currentProduct || !flashModalVariantId) return;
    if (variantFlashMode !== "none" && !variantFlashDate) {
      setVariantFlashError("Elegí una fecha.");
      return;
    }
    if (variantFlashMode === "exact" && !variantFlashTime) {
      setVariantFlashError("Elegí una hora.");
      return;
    }
    const ofertaFlashHasta =
      variantFlashMode === "none"
        ? null
        : variantFlashMode === "endOfDay"
          ? gmt4ToUtcIso(variantFlashDate, "23:59", 59)
          : gmt4ToUtcIso(variantFlashDate, variantFlashTime);
    setVariantFlashSubmitting(true);
    setVariantFlashError("");
    try {
      const updated = await apiPatch<Product>(`/products/${currentProduct.id}/variants/${flashModalVariantId}`, {
        ofertaFlashHasta,
      });
      setCurrentProduct(updated);
      setFlashModalVariantId(null);
    } catch (e) {
      setVariantFlashError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setVariantFlashSubmitting(false);
    }
  }

  /** Sube inmediatamente (no queda pendiente al submit del form, a diferencia de la imagen del
   * producto): la variante ya existe en este punto, no hace falta esperar a nada más. */
  async function handleUploadVariantImage(variantId: string, file: File) {
    if (!currentProduct) return;
    setVariantRowError((prev) => ({ ...prev, [variantId]: "" }));
    try {
      const updated = await apiUpload<Product>(`/products/${currentProduct.id}/variants/${variantId}/image`, file);
      setCurrentProduct(updated);
    } catch (e) {
      setVariantRowError((prev) => ({
        ...prev,
        [variantId]: e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e),
      }));
    }
  }

  function loadPresentaciones(varianteId: string) {
    getPresentaciones(varianteId).then(setPresentaciones);
  }

  function openPresentaciones(varianteId: string) {
    setPresentacionesVarianteId(varianteId);
    setNuevaCantidadMl("");
    setNuevoPrecioBs("");
    setPresentacionError("");
    loadPresentaciones(varianteId);
  }

  async function handleAddPresentacion(e: React.FormEvent) {
    e.preventDefault();
    if (!presentacionesVarianteId) return;
    setPresentacionError("");
    if (!nuevaCantidadMl || !nuevoPrecioBs) {
      setPresentacionError("Completá la cantidad en ml y el precio.");
      return;
    }
    setPresentacionSubmitting(true);
    try {
      await createPresentacion(presentacionesVarianteId, {
        cantidadMl: Number(nuevaCantidadMl),
        precioVentaBs: Number(nuevoPrecioBs),
      });
      setNuevaCantidadMl("");
      setNuevoPrecioBs("");
      loadPresentaciones(presentacionesVarianteId);
    } catch (e) {
      setPresentacionError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setPresentacionSubmitting(false);
    }
  }

  async function handleDeactivatePresentacion(presentacion: PresentacionVenta) {
    if (!presentacionesVarianteId || !confirm(`¿Desactivar la presentación de ${presentacion.cantidadMl} ml?`)) return;
    try {
      await updatePresentacion(presentacion.id, { activo: false });
      loadPresentaciones(presentacionesVarianteId);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  // Vista previa en vivo: misma fórmula que calcula el backend.
  // Precio $ = Precio de compra + costos heredados de la categoría + utilidad.
  const selectedCategory = categories.find((cat) => cat.id === categoryId);
  const logisticsCostPreview = Number(selectedCategory?.logisticsCost ?? 0);
  const shippingCostPreview = Number(selectedCategory?.shippingCost ?? 0);
  const securityCostPreview = Number(selectedCategory?.securityCost ?? 0);
  const pricePreview =
    Number(purchasePrice || 0) + logisticsCostPreview + shippingCostPreview + securityCostPreview + Number(utility || 0);
  // Precio May Bs = Precio $ * tipo de cambio; Precio Final Bs = (Precio May Bs + Add May) -
  // Descuento. Mismas fórmulas que el backend.
  const wholesaleBsPreview = pricePreview * exchangeRate;
  const finalBsPreview = roundUpToTen(wholesaleBsPreview + Number(minPriceBs || 0) - Number(discountBs || 0));

  const variantPricePreview =
    Number(variantForm.purchasePrice || 0) +
    logisticsCostPreview +
    shippingCostPreview +
    securityCostPreview +
    Number(variantForm.utility || 0);
  const variantWholesaleBsPreview = variantPricePreview * exchangeRate;
  const variantFinalBsPreview = roundUpToTen(
    variantWholesaleBsPreview + Number(variantForm.minPriceBs || 0) - Number(variantForm.discountBs || 0),
  );

  return (
    <div className="card" style={{ maxWidth: "85%", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{editing ? "Editar producto" : "Nuevo producto"}</h1>
        <button type="button" className="link-button" onClick={() => router.push("/dashboard/products")}>
          Volver
        </button>
      </div>

      {editing && (
        <p style={{ margin: "-12px 0 20px", fontSize: 12, color: "var(--muted)" }}>
          ID Producto: <span style={{ fontFamily: "monospace" }}>{editing.productCode}</span>
        </p>
      )}

      {flashMessage && (
        <div className="success-banner">
          <span>{flashMessage}</span>
          <button type="button" className="link-button" style={{ margin: 0 }} onClick={() => setLocalFlashMessage(null)}>
            Cerrar
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 1. Datos generales: Categoría → Subcategoría, Marca, Nombre — todo en una fila, ahora que
            el formulario tiene ancho de sobra para no tener que apilarlos. */}
        <div className="form-section">
          <h2 className="section-label">Datos generales</h2>
          <div className="grid-4">
            <div>
              <label>Categoría</label>
              <select
                className="field"
                value={rootCategoryId}
                onChange={(e) => handleRootCategoryChange(e.target.value)}
                required
              >
                <option value="">— Elegir —</option>
                {rootCategoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            {rootCategoryId && subCategoryOptions.length > 0 && (
              <div>
                <label>Subcategoría</label>
                <select
                  className="field"
                  value={categoryId === rootCategoryId ? "" : categoryId}
                  onChange={(e) => handleSubCategoryChange(e.target.value)}
                  required
                >
                  <option value="">— Elegir —</option>
                  {subCategoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label>Marca</label>
              <select
                className="field"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                disabled={!rootCategoryId}
              >
                <option value="">— Sin marca —</option>
                {availableBrands.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
              {!rootCategoryId && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>Elegí una categoría primero.</p>
              )}
            </div>
            <div>
              <label>Nombre</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>
        </div>

        {/* 4. Atributos: propios de la categoría, múltiples, y variantes con precio propio */}
        {categoryId && hasAttributes && (
          <div className="form-section">
            <h2 className="section-label">Atributos</h2>

            {regularAttrs.length > 0 && (
              <div className="grid-3" style={{ marginBottom: multiValueAttrs.length > 0 || pricedVariantAttrs.length > 0 ? 14 : 0 }}>
                {regularAttrs.map((def) => (
                  <div key={def.id} style={def.allowMultiple ? { gridColumn: "1 / -1" } : undefined}>
                    <label>
                      {def.name}{def.isRequired ? " *" : ""}
                      {def.inherited ? <span className="badge badge-muted" style={{ marginLeft: 6 }}>Heredado</span> : null}
                    </label>
                    {def.type === "SELECT" && def.allowMultiple && (
                      <div className="pill-group">
                        {def.options.map((opt) => {
                          const selected = multiSelectValues[def.id]?.has(opt.id) ?? false;
                          return (
                            <button
                              type="button"
                              key={opt.id}
                              className={`color-pill${selected ? " selected" : ""}`}
                              style={selected ? { background: opt.color ?? "#c9a96e" } : undefined}
                              onClick={() => toggleMultiSelectValue(def.id, opt.id)}
                            >
                              {opt.value}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {def.type === "SELECT" && !def.allowMultiple && (
                      <select
                        className="field"
                        value={attributeValues[def.id] ?? ""}
                        onChange={(e) => setAttributeValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                      >
                        <option value="">— Elegir —</option>
                        {def.options.map((opt) => (
                          <option key={opt.id} value={opt.id}>{opt.value}</option>
                        ))}
                      </select>
                    )}
                    {def.type === "BOOLEAN" && (
                      <select
                        className="field"
                        value={attributeValues[def.id] ?? ""}
                        onChange={(e) => setAttributeValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                      >
                        <option value="">— Sin especificar —</option>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    )}
                    {def.type === "NUMBER" && (
                      <input
                        className="field"
                        type="number"
                        value={attributeValues[def.id] ?? ""}
                        onChange={(e) => setAttributeValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                      />
                    )}
                    {def.type === "TEXT" && (
                      <input
                        className="field"
                        value={attributeValues[def.id] ?? ""}
                        onChange={(e) => setAttributeValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {multiValueAttrs.length > 0 && (
              <div className="subsection" style={{ marginBottom: pricedVariantAttrs.length > 0 ? 14 : 0 }}>
                <p className="subsection-title">Valores múltiples (sin precio)</p>
                {!currentProduct ? (
                  <p className="subsection-hint" style={{ marginBottom: 0 }}>
                    Guardá el producto primero; después vas a poder agregarle sus propios valores acá mismo (editando).
                  </p>
                ) : (
                  <div className="grid-2">
                    {multiValueAttrs.map((def) => {
                      const values = currentProduct.variantOptionValues.filter((v) => v.attributeId === def.id);
                      return (
                        <div key={def.id}>
                          <label>
                            {def.name}{def.isRequired ? " *" : ""} <span className="badge badge-muted">Múltiple</span>
                          </label>
                          <div className="checkbox-group-items" style={{ marginBottom: 8 }}>
                            {values.length === 0 && (
                              <span style={{ color: "var(--muted)", fontSize: 13 }}>Sin valores todavía.</span>
                            )}
                            {values.map((v) => (
                              <span key={v.id} className="badge">
                                {v.value}
                                <button
                                  type="button"
                                  className="link-button danger"
                                  style={{ marginLeft: 6, fontSize: 12 }}
                                  onClick={() => handleRemoveVariantValue(v.id, setMultiValueError)}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              className="field"
                              value={newMultiValue[def.id] ?? ""}
                              onChange={(e) => setNewMultiValue((prev) => ({ ...prev, [def.id]: e.target.value }))}
                              placeholder="Ej: Menta"
                            />
                            <button
                              type="button"
                              className="button"
                              onClick={() =>
                                handleAddVariantValue(
                                  def.id,
                                  newMultiValue[def.id] ?? "",
                                  () => setNewMultiValue((prev) => ({ ...prev, [def.id]: "" })),
                                  setMultiValueError,
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {multiValueError && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{multiValueError}</p>}
                  </div>
                )}
              </div>
            )}

            {pricedVariantAttrs.length > 0 && (
              <div className="subsection">
                <p className="subsection-title">Variantes con precio propio</p>
                <p className="subsection-hint">
                  Esta categoría fija el precio por variante, así que no se pide Precio de compra/Utilidad del
                  producto en general (sería redundante).
                </p>

                {!currentProduct && (
                  <p className="subsection-hint" style={{ marginBottom: 0 }}>
                    Guardá el producto primero; después vas a poder agregarle sus propios valores y variantes acá mismo (editando).
                  </p>
                )}

                {currentProduct && (
                  <>
                    {/* Valores propios por atributo con precio propio (ej. Tamaño: 50 ML, 100 ML) */}
                    <div className="grid-2" style={{ marginBottom: 14 }}>
                      {pricedVariantAttrs.map((def) => {
                        const values = currentProduct.variantOptionValues.filter((v) => v.attributeId === def.id);
                        return (
                          <div key={def.id}>
                            <label style={{ fontSize: 12, color: "var(--muted)" }}>{def.name}</label>
                            <div className="checkbox-group-items" style={{ marginBottom: 8 }}>
                              {values.length === 0 && (
                                <span style={{ color: "var(--muted)", fontSize: 13 }}>Sin valores todavía.</span>
                              )}
                              {values.map((v) => (
                                <span key={v.id} className="badge">
                                  {v.value}
                                  <button
                                    type="button"
                                    className="link-button danger"
                                    style={{ marginLeft: 6, fontSize: 12 }}
                                    onClick={() => handleRemoveVariantValue(v.id, setVariantValueError)}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                className="field"
                                value={newVariantValue[def.id] ?? ""}
                                onChange={(e) => setNewVariantValue((prev) => ({ ...prev, [def.id]: e.target.value }))}
                                placeholder="Ej: 50 ML"
                              />
                              <button
                                type="button"
                                className="button"
                                onClick={() =>
                                  handleAddVariantValue(
                                    def.id,
                                    newVariantValue[def.id] ?? "",
                                    () => setNewVariantValue((prev) => ({ ...prev, [def.id]: "" })),
                                    setVariantValueError,
                                  )
                                }
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {variantValueError && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{variantValueError}</p>}
                    </div>

                    {currentProduct.variants.length > 0 && (
                      <div style={{ overflowX: "auto", marginBottom: 14 }}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Imagen</th>
                              <th>Disponible</th>
                              <th>ID</th>
                              <th>Combinación</th>
                              <th>Unidad</th>
                              <th>Compra</th>
                              <th>Utilidad</th>
                              <th>Precio $</th>
                              <th>May Bs</th>
                              <th>Add May</th>
                              <th>Desc. Bs</th>
                              <th>Final Bs</th>
                              <th>Oferta Flash</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentProduct.variants.map((variant) => (
                              <Fragment key={variant.id}>
                                <tr>
                                  <td>
                                    {variant.unidad === "PZA" ? (
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {productImageSrc(variant.imageUrl) ? (
                                          <img
                                            src={productImageSrc(variant.imageUrl)!}
                                            alt=""
                                            style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4, border: "1px solid var(--color-divider, var(--line))" }}
                                          />
                                        ) : (
                                          <span className="cell-muted" style={{ fontSize: 11 }}>Sin imagen</span>
                                        )}
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png,image/webp,image/gif"
                                          style={{ width: 90, fontSize: 11 }}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleUploadVariantImage(variant.id, file);
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <span className="cell-muted">—</span>
                                    )}
                                  </td>
                                  <td>
                                    <select
                                      className="field"
                                      value={variant.disponible ? "1" : "0"}
                                      onChange={(e) => handleUpdateVariantDisponible(variant.id, e.target.value === "1")}
                                      style={{ width: 130 }}
                                    >
                                      <option value="1">Disponible</option>
                                      <option value="0">No disponible</option>
                                    </select>
                                  </td>
                                  <td>{variant.variantCode}</td>
                                  <td>
                                    {variant.options
                                      .map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`)
                                      .join(" · ")}
                                  </td>
                                  <td>
                                    <span className={`badge ${variant.unidad === "ML" ? "badge-accent" : "badge-muted"}`}>
                                      {variant.unidad === "ML" ? "Ml" : "Pza"}
                                    </span>
                                    {variant.unidad === "ML" && (
                                      <button
                                        type="button"
                                        className="link-button"
                                        style={{ marginLeft: 8, fontSize: 12 }}
                                        onClick={() => openPresentaciones(variant.id)}
                                      >
                                        Presentaciones
                                      </button>
                                    )}
                                  </td>
                                  <td>
                                    <input
                                      className="field"
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      defaultValue={variant.purchasePrice}
                                      onBlur={(e) => handleUpdateVariantField(variant.id, "purchasePrice", e.target.value)}
                                      style={{ width: 90 }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className="field"
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      defaultValue={variant.utility}
                                      onBlur={(e) => handleUpdateVariantField(variant.id, "utility", e.target.value)}
                                      style={{ width: 90 }}
                                    />
                                  </td>
                                  <td>${variant.price.toFixed(2)}</td>
                                  <td>Bs {variant.wholesalePriceBs.toFixed(2)}</td>
                                  <td>
                                    <input
                                      className="field"
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      placeholder="—"
                                      defaultValue={variant.minPriceBs ?? ""}
                                      onBlur={(e) => handleUpdateVariantField(variant.id, "minPriceBs", e.target.value)}
                                      style={{ width: 90 }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className="field"
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      defaultValue={variant.discountBs}
                                      onBlur={(e) => handleUpdateVariantField(variant.id, "discountBs", e.target.value)}
                                      style={{ width: 90 }}
                                    />
                                  </td>
                                  <td>Bs {variant.finalPriceBs.toFixed(2)}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="link-button"
                                      onClick={() => openVariantFlashModal(variant)}
                                    >
                                      {variant.ofertaFlashHasta ? "Activa ⚡" : "Sin temporizador"}
                                    </button>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="link-button danger"
                                      onClick={() => handleDeleteVariant(variant.id)}
                                    >
                                      Eliminar
                                    </button>
                                  </td>
                                </tr>
                                {variantRowError[variant.id] && (
                                  <tr>
                                    <td colSpan={13} className="error-text" style={{ fontSize: 12 }}>
                                      {variantRowError[variant.id]}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div
                      className="grid-3"
                      style={{
                        background: "var(--color-surface, var(--surface))",
                        padding: 12,
                        borderRadius: 8,
                        border: "1px solid var(--color-divider, var(--line))",
                      }}
                    >
                      {pricedVariantAttrs.map((def) => {
                        const values = currentProduct.variantOptionValues.filter((v) => v.attributeId === def.id);
                        return (
                          <div key={def.id}>
                            <label style={{ fontSize: 12, color: "var(--muted)" }}>{def.name}</label>
                            <select
                              className="field"
                              value={variantForm.optionsByAttribute[def.id] ?? ""}
                              onChange={(e) =>
                                setVariantForm((prev) => ({
                                  ...prev,
                                  optionsByAttribute: { ...prev.optionsByAttribute, [def.id]: e.target.value },
                                }))
                              }
                            >
                              <option value="">— Elegir —</option>
                              {values.map((v) => (
                                <option key={v.id} value={v.id}>{v.value}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                      <div>
                        <label style={{ fontSize: 12, color: "var(--muted)" }}>Unidad</label>
                        <select
                          className="field"
                          value={variantForm.unidad}
                          onChange={(e) => setVariantForm((prev) => ({ ...prev, unidad: e.target.value as UnidadVariante }))}
                        >
                          <option value="PZA">Pieza (de siempre)</option>
                          <option value="ML">Ml (no se vende directo — solo por presentaciones)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "var(--muted)" }}>Precio de compra</label>
                        <input
                          className="field"
                          type="number"
                          min="0"
                          step="0.01"
                          value={variantForm.purchasePrice}
                          onChange={(e) => setVariantForm((prev) => ({ ...prev, purchasePrice: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "var(--muted)" }}>Utilidad</label>
                        <input
                          className="field"
                          type="number"
                          step="0.01"
                          value={variantForm.utility}
                          onChange={(e) => setVariantForm((prev) => ({ ...prev, utility: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "var(--muted)" }}>Add May</label>
                        <input
                          className="field"
                          type="number"
                          min="0"
                          step="0.01"
                          value={variantForm.minPriceBs}
                          onChange={(e) => setVariantForm((prev) => ({ ...prev, minPriceBs: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "var(--muted)" }}>Descuento Bs</label>
                        <input
                          className="field"
                          type="number"
                          min="0"
                          step="0.01"
                          value={variantForm.discountBs}
                          onChange={(e) => setVariantForm((prev) => ({ ...prev, discountBs: e.target.value }))}
                        />
                      </div>
                      <div className="price-stats" style={{ gridColumn: "1 / -1", marginTop: 4 }}>
                        <div className="price-stat">
                          <span className="price-stat-label">Precio $</span>
                          <span className="price-stat-value">${variantPricePreview.toFixed(2)}</span>
                        </div>
                        <div className="price-stat">
                          <span className="price-stat-label">May Bs</span>
                          <span className="price-stat-value">Bs {variantWholesaleBsPreview.toFixed(2)}</span>
                        </div>
                        <div className="price-stat price-stat-final">
                          <span className="price-stat-label">Final Bs</span>
                          <span className="price-stat-value">Bs {variantFinalBsPreview.toFixed(2)}</span>
                        </div>
                      </div>
                      {variantError && <p className="error-text" style={{ gridColumn: "1 / -1" }}>{variantError}</p>}
                      <button
                        type="button"
                        className="button"
                        onClick={handleAddVariant}
                        disabled={variantSubmitting}
                        style={{ gridColumn: "1 / -1", justifyContent: "center" }}
                      >
                        {variantSubmitting ? "Agregando..." : "+ Agregar variante"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. Costos y precios + 6. Imagen: lado a lado — la imagen no necesita todo el ancho, y
            apilarlas debajo de todo lo demás desperdiciaba el espacio que da un formulario ancho. */}
        <div className="form-section">
          <div className="form-columns">
            <div>
              {selectedCategory ? (
                <>
                  <h2 className="section-label">Costos y precios de &quot;{selectedCategory.name}&quot;</h2>
                  <p className="cost-breakdown-line">
                    Costos heredados — Logística: ${logisticsCostPreview.toFixed(2)} · Envío: ${shippingCostPreview.toFixed(2)} ·
                    Seguridad: ${securityCostPreview.toFixed(2)}
                  </p>

                  {pricedVariantAttrs.length === 0 ? (
                    <>
                      <div className="grid-2" style={{ marginTop: 14, marginBottom: 10 }}>
                        <div>
                          <label>Precio de compra</label>
                          <input
                            className="field"
                            type="number"
                            min="0"
                            step="0.01"
                            value={purchasePrice}
                            onChange={(e) => setPurchasePrice(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label>Utilidad</label>
                          <input
                            className="field"
                            type="number"
                            step="0.01"
                            value={utility}
                            onChange={(e) => setUtility(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid-2">
                        <div>
                          <label>Add May</label>
                          <input
                            className="field"
                            type="number"
                            min="0"
                            step="0.01"
                            value={minPriceBs}
                            onChange={(e) => setMinPriceBs(e.target.value)}
                            placeholder="Opcional"
                          />
                        </div>
                        <div>
                          <label>Descuento Bs</label>
                          <input
                            className="field"
                            type="number"
                            min="0"
                            step="0.01"
                            value={discountBs}
                            onChange={(e) => setDiscountBs(e.target.value)}
                          />
                        </div>
                      </div>
                      <p className="cost-breakdown-line" style={{ marginTop: 10 }}>
                        Tipo de cambio: 1 $ = {exchangeRate} Bs
                      </p>
                      <div className="price-stats">
                        <div className="price-stat">
                          <span className="price-stat-label">Precio $</span>
                          <span className="price-stat-value">${pricePreview.toFixed(2)}</span>
                        </div>
                        <div className="price-stat">
                          <span className="price-stat-label">May Bs</span>
                          <span className="price-stat-value">Bs {wholesaleBsPreview.toFixed(2)}</span>
                        </div>
                        <div className="price-stat price-stat-final">
                          <span className="price-stat-label">Final Bs</span>
                          <span className="price-stat-value">Bs {finalBsPreview.toFixed(2)}</span>
                        </div>
                      </div>
                      {currentProduct && currentProduct.variants[0] && (
                        <div style={{ marginTop: 14, maxWidth: 220 }}>
                          <label>Disponible</label>
                          <select
                            className="field"
                            value={currentProduct.variants[0].disponible ? "1" : "0"}
                            onChange={(e) => handleUpdateVariantDisponible(currentProduct.variants[0].id, e.target.value === "1")}
                          >
                            <option value="1">Disponible</option>
                            <option value="0">No disponible</option>
                          </select>
                        </div>
                      )}
                    </>
                  ) : (
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)" }}>
                      El precio de compra, la utilidad y los precios en Bs se cargan por variante (sección Atributos, arriba).
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h2 className="section-label">Costos y precios</h2>
                  <p className="cell-muted" style={{ fontSize: 13 }}>Elegí una categoría para ver los costos y precios.</p>
                </>
              )}
            </div>

            <div>
              <h2 className="section-label">Imagen</h2>
              <div className="image-uploader">
                {imagePreview ? (
                  <img src={imagePreview} alt="Vista previa" />
                ) : (
                  <div className="image-uploader-placeholder">Sin imagen</div>
                )}
                <input
                  className="field"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
                  style={{ background: "transparent", border: 0, padding: 0 }}
                />
              </div>
            </div>
          </div>
        </div>

        {pricedVariantAttrs.length === 0 ? (
          <div className="card" style={{ marginTop: 20 }}>
            <h2 className="section-label">Oferta Flash</h2>
            <p className="cell-muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
              Mientras el temporizador esté activo, el producto aparece en el filtro "Ofertas Flash" del home. La
              hora se interpreta siempre en GMT-4 (la zona horaria de la tienda).
            </p>
            <div className="grid-2">
              <div>
                <label>Temporizador</label>
                <select
                  className="field"
                  value={flashMode}
                  onChange={(e) => setFlashMode(e.target.value as "none" | "exact" | "endOfDay")}
                >
                  <option value="none">Sin temporizador</option>
                  <option value="exact">Hasta una hora exacta</option>
                  <option value="endOfDay">Hasta el final del día (23:59:59)</option>
                </select>
              </div>
              {flashMode !== "none" && (
                <div>
                  <label>Fecha (GMT-4)</label>
                  <input className="field" type="date" value={flashDate} onChange={(e) => setFlashDate(e.target.value)} />
                </div>
              )}
            </div>
            {flashMode === "exact" && (
              <div style={{ marginTop: 12, maxWidth: 220 }}>
                <label>Hora (GMT-4)</label>
                <input className="field" type="time" value={flashTime} onChange={(e) => setFlashTime(e.target.value)} />
              </div>
            )}
          </div>
        ) : (
          <p className="cell-muted" style={{ fontSize: 13, marginTop: 20 }}>
            Este producto tiene variantes con precio propio: la Oferta Flash se configura por variante, en la
            columna "Oferta Flash" de la tabla de variantes (arriba).
          </p>
        )}

        {formError && <p className="error-text">{formError}</p>}
        <div className="form-actions">
          <button type="button" className="link-button" onClick={() => router.push("/dashboard/products")}>
            Cancelar
          </button>
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>

      {presentacionesVarianteId && (
        <Modal title="Presentaciones de venta" onClose={() => setPresentacionesVarianteId(null)}>
          {presentaciones.length === 0 ? (
            <p className="cell-muted" style={{ fontSize: 13 }}>Ninguna todavía.</p>
          ) : (
            <div style={{ marginBottom: 12 }}>
              {presentaciones.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                  <span>
                    {p.cantidadMl} ml — Bs {p.precioVentaBs}
                    {!p.activo && <span className="badge badge-muted" style={{ marginLeft: 8 }}>Inactiva</span>}
                  </span>
                  {p.activo && (
                    <button type="button" className="link-button" onClick={() => handleDeactivatePresentacion(p)}>
                      Desactivar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <form className="form-grid" onSubmit={handleAddPresentacion}>
            <div className="grid-2">
              <div>
                <label>Cantidad (ml)</label>
                <input
                  className="field"
                  type="number"
                  min="1"
                  step="1"
                  value={nuevaCantidadMl}
                  onChange={(e) => setNuevaCantidadMl(e.target.value)}
                />
              </div>
              <div>
                <label>Precio de venta Bs</label>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="0.01"
                  value={nuevoPrecioBs}
                  onChange={(e) => setNuevoPrecioBs(e.target.value)}
                />
              </div>
            </div>
            {presentacionError && <p className="error-text">{presentacionError}</p>}
            <div className="form-actions">
              <button type="submit" className="button" disabled={presentacionSubmitting}>
                {presentacionSubmitting ? "Agregando..." : "+ Agregar presentación"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {flashModalVariantId && (
        <Modal title="Oferta Flash de la variante" onClose={() => setFlashModalVariantId(null)}>
          <p className="cell-muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
            La hora se interpreta siempre en GMT-4 (la zona horaria de la tienda).
          </p>
          <div className="grid-2">
            <div>
              <label>Temporizador</label>
              <select
                className="field"
                value={variantFlashMode}
                onChange={(e) => setVariantFlashMode(e.target.value as "none" | "exact" | "endOfDay")}
              >
                <option value="none">Sin temporizador</option>
                <option value="exact">Hasta una hora exacta</option>
                <option value="endOfDay">Hasta el final del día (23:59:59)</option>
              </select>
            </div>
            {variantFlashMode !== "none" && (
              <div>
                <label>Fecha (GMT-4)</label>
                <input
                  className="field"
                  type="date"
                  value={variantFlashDate}
                  onChange={(e) => setVariantFlashDate(e.target.value)}
                />
              </div>
            )}
          </div>
          {variantFlashMode === "exact" && (
            <div style={{ marginTop: 12, maxWidth: 220 }}>
              <label>Hora (GMT-4)</label>
              <input
                className="field"
                type="time"
                value={variantFlashTime}
                onChange={(e) => setVariantFlashTime(e.target.value)}
              />
            </div>
          )}
          {variantFlashError && <p className="error-text">{variantFlashError}</p>}
          <div className="form-actions">
            <button type="button" className="link-button" onClick={() => setFlashModalVariantId(null)}>
              Cancelar
            </button>
            <button type="button" className="button" disabled={variantFlashSubmitting} onClick={handleSaveVariantFlash}>
              {variantFlashSubmitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
