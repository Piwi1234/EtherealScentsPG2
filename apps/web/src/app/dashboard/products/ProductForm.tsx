"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_ORIGIN, apiDelete, apiGet, apiPatch, apiPost, apiUpload, ApiError } from "../../../lib/api";
import { consumeFlashMessage, setFlashMessage } from "../../../lib/flash";
import type { Attribute, Brand, Category, Product } from "../../../lib/types";

function productImageSrc(imageUrl: string | null): string | null {
  return imageUrl ? `${API_ORIGIN}${imageUrl}` : null;
}

type VariantFormState = { optionsByAttribute: Record<string, string>; purchasePrice: string; utility: string };

const EMPTY_VARIANT_FORM: VariantFormState = { optionsByAttribute: {}, purchasePrice: "", utility: "0" };

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
  const [attributeDefs, setAttributeDefs] = useState<Attribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [multiValues, setMultiValues] = useState<Record<string, Set<string>>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(productImageSrc(editing?.imageUrl ?? null));
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flashMessage, setLocalFlashMessage] = useState<string | null>(null);

  const [currentProduct, setCurrentProduct] = useState<Product | null>(editing);
  const [variantForm, setVariantForm] = useState<VariantFormState>(EMPTY_VARIANT_FORM);
  const [variantError, setVariantError] = useState("");
  const [variantSubmitting, setVariantSubmitting] = useState(false);

  const rootCategoryOptions = categories.filter((cat) => cat.parentId === null);
  const subCategoryOptions = categories.filter((cat) => cat.parentId === rootCategoryId);

  // Atributos normales (un valor), múltiples sin precio (ej. sabores) y con precio propio (ej. tamaño).
  const regularAttrs = attributeDefs.filter((def) => def.variantMode === "NONE");
  const multiValueAttrs = attributeDefs.filter((def) => def.variantMode === "MULTI_VALUE");
  const pricedVariantAttrs = attributeDefs.filter((def) => def.variantMode === "PRICED_VARIANT");
  const hasAttributes = regularAttrs.length > 0 || multiValueAttrs.length > 0 || pricedVariantAttrs.length > 0;

  useEffect(() => {
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    apiGet<Brand[]>("/brands").then(setBrands).catch(() => {});
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
  useEffect(() => {
    if (!editing) return;
    loadAttributesFor(editing.categoryId).then(() => {
      const values: Record<string, string> = {};
      const multi: Record<string, Set<string>> = {};
      for (const pv of editing.attributeValues) {
        if (pv.attribute.variantMode === "MULTI_VALUE") {
          if (pv.optionId) {
            const set = multi[pv.attributeId] ?? new Set<string>();
            set.add(pv.optionId);
            multi[pv.attributeId] = set;
          }
          continue;
        }
        if (pv.optionId) values[pv.attributeId] = pv.optionId;
        else if (pv.valueText !== null) values[pv.attributeId] = pv.valueText;
        else if (pv.valueNumber !== null) values[pv.attributeId] = pv.valueNumber;
        else if (pv.valueBoolean !== null) values[pv.attributeId] = String(pv.valueBoolean);
      }
      setAttributeValues(values);
      setMultiValues(multi);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  function handleImageSelect(file: File | null) {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : productImageSrc(editing?.imageUrl ?? null));
  }

  function toggleMultiValue(attributeId: string, optionId: string) {
    setMultiValues((prev) => {
      const next = new Set(prev[attributeId] ?? []);
      next.has(optionId) ? next.delete(optionId) : next.add(optionId);
      return { ...prev, [attributeId]: next };
    });
  }

  async function handleRootCategoryChange(id: string) {
    setRootCategoryId(id);
    setAttributeValues({});
    setMultiValues({});
    setVariantForm(EMPTY_VARIANT_FORM);
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
    setMultiValues({});
    setVariantForm(EMPTY_VARIANT_FORM);
    await loadAttributesFor(id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!categoryId) {
      setFormError("Elegí una categoría (y subcategoría, si corresponde).");
      return;
    }

    const missing = regularAttrs.filter((def) => def.isRequired && !attributeValues[def.id]);
    const missingMulti = multiValueAttrs.filter((def) => def.isRequired && !(multiValues[def.id]?.size));
    if (missing.length > 0 || missingMulti.length > 0) {
      setFormError(`Falta completar: ${[...missing, ...missingMulti].map((m) => m.name).join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      const regularPayload = regularAttrs
        .filter((def) => attributeValues[def.id])
        .map((def) => {
          const raw = attributeValues[def.id];
          if (def.type === "SELECT") return { attributeId: def.id, optionId: raw };
          if (def.type === "NUMBER") return { attributeId: def.id, valueNumber: Number(raw) };
          if (def.type === "BOOLEAN") return { attributeId: def.id, valueBoolean: raw === "true" };
          return { attributeId: def.id, valueText: raw };
        });
      const multiPayload = multiValueAttrs.flatMap((def) =>
        Array.from(multiValues[def.id] ?? []).map((optionId) => ({ attributeId: def.id, optionId })),
      );

      // Si la categoría tiene atributos con precio propio, el precio se carga por variante: pedirlo
      // acá también sería redundante. Ojo: hay que OMITIR estos campos (no mandar 0), porque el
      // backend valida `purchasePrice` como número positivo cuando el campo está presente.
      const usesPricedVariants = pricedVariantAttrs.length > 0;
      const payload = {
        name,
        purchasePrice: usesPricedVariants ? undefined : Number(purchasePrice),
        utility: usesPricedVariants ? undefined : Number(utility || 0),
        brandId: brandId || undefined,
        categoryId,
        attributeValues: [...regularPayload, ...multiPayload],
      };

      const saved = editing
        ? await apiPatch<Product>(`/products/${editing.id}`, payload)
        : await apiPost<Product>("/products", payload);

      if (imageFile) {
        await apiUpload(`/products/${saved.id}/image`, imageFile);
      }

      setFlashMessage(editing ? "Producto editado correctamente." : "Producto creado correctamente.");

      // Si el producto usa variantes con precio propio y recién se creó, seguimos en la edición
      // para poder cargarlas de una: si volviéramos al listado, habría que volver a entrar a mano.
      if (usesPricedVariants && !editing) {
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

  async function handleAddVariant() {
    if (!currentProduct) return;
    setVariantError("");

    const options = pricedVariantAttrs
      .filter((def) => variantForm.optionsByAttribute[def.id])
      .map((def) => ({ attributeId: def.id, optionId: variantForm.optionsByAttribute[def.id] }));
    if (options.length === 0) {
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
        options,
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

  // Vista previa en vivo: misma fórmula que calcula el backend.
  // Precio $ = Precio de compra + costos heredados de la categoría + utilidad.
  const selectedCategory = categories.find((cat) => cat.id === categoryId);
  const logisticsCostPreview = Number(selectedCategory?.logisticsCost ?? 0);
  const shippingCostPreview = Number(selectedCategory?.shippingCost ?? 0);
  const securityCostPreview = Number(selectedCategory?.securityCost ?? 0);
  const pricePreview =
    Number(purchasePrice || 0) + logisticsCostPreview + shippingCostPreview + securityCostPreview + Number(utility || 0);

  return (
    <div className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{editing ? "Editar producto" : "Nuevo producto"}</h1>
        <button type="button" className="link-button" onClick={() => router.push("/dashboard/products")}>
          Volver
        </button>
      </div>

      {flashMessage && (
        <div className="success-banner">
          <span>{flashMessage}</span>
          <button type="button" className="link-button" style={{ margin: 0 }} onClick={() => setLocalFlashMessage(null)}>
            Cerrar
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 1. Categoría → Subcategoría */}
        <div className="form-section">
          <h2 className="section-label">Categoría</h2>
          <div className={subCategoryOptions.length > 0 ? "grid-2" : undefined}>
            <div>
              {subCategoryOptions.length > 0 && <label>Categoría</label>}
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
          </div>
        </div>

        {/* 2. Marca */}
        <div className="form-section">
          <h2 className="section-label">Marca</h2>
          <select className="field" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">— Sin marca —</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </div>

        {/* 3. Nombre */}
        <div className="form-section">
          <h2 className="section-label">Nombre</h2>
          <div className={editing ? "grid-2" : undefined}>
            <div>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {editing && (
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)" }}>ID Producto</label>
                <input className="field" value={editing.productCode} disabled />
              </div>
            )}
          </div>
        </div>

        {/* 4. Imagen */}
        <div className="form-section">
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

        {/* 5. Atributos: propios de la categoría, múltiples, y variantes con precio propio */}
        {categoryId && hasAttributes && (
          <div className="form-section">
            <h2 className="section-label">Atributos</h2>

            {regularAttrs.length > 0 && (
              <div className="grid-2" style={{ marginBottom: multiValueAttrs.length > 0 || pricedVariantAttrs.length > 0 ? 14 : 0 }}>
                {regularAttrs.map((def) => (
                  <div key={def.id}>
                    <label>
                      {def.name}{def.isRequired ? " *" : ""}
                      {def.inherited ? <span className="badge badge-muted" style={{ marginLeft: 6 }}>Heredado</span> : null}
                    </label>
                    {def.type === "SELECT" && (
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
              <div className="grid-2" style={{ marginBottom: pricedVariantAttrs.length > 0 ? 14 : 0 }}>
                {multiValueAttrs.map((def) => (
                  <div key={def.id}>
                    <label>
                      {def.name}{def.isRequired ? " *" : ""} <span className="badge badge-muted">Múltiple</span>
                    </label>
                    <div className="checkbox-group-items">
                      {def.options.map((opt) => (
                        <label key={opt.id} className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={multiValues[def.id]?.has(opt.id) ?? false}
                            onChange={() => toggleMultiValue(def.id, opt.id)}
                          />
                          {opt.value}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
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
                    Guardá el producto primero; después vas a poder agregarle variantes acá mismo (editando).
                  </p>
                )}

                {currentProduct && (
                  <>
                    {currentProduct.variants.length > 0 && (
                      <table className="table" style={{ marginBottom: 14, background: "var(--surface)" }}>
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Combinación</th>
                            <th>Compra</th>
                            <th>Utilidad</th>
                            <th>Precio $</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentProduct.variants.map((variant) => (
                            <tr key={variant.id}>
                              <td>{variant.variantCode}</td>
                              <td>{variant.options.map((o) => `${o.attribute.name}: ${o.option.value}`).join(" · ")}</td>
                              <td>${variant.purchasePrice}</td>
                              <td>${variant.utility}</td>
                              <td>${variant.price.toFixed(2)}</td>
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
                          ))}
                        </tbody>
                      </table>
                    )}

                    <div className="grid-2" style={{ background: "var(--surface)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
                      {pricedVariantAttrs.map((def) => (
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
                            {def.options.map((opt) => (
                              <option key={opt.id} value={opt.id}>{opt.value}</option>
                            ))}
                          </select>
                        </div>
                      ))}
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
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)", gridColumn: "1 / -1" }}>
                        Precio $ de esta variante (compra + costos + utilidad): $
                        {(
                          Number(variantForm.purchasePrice || 0) +
                          logisticsCostPreview +
                          shippingCostPreview +
                          securityCostPreview +
                          Number(variantForm.utility || 0)
                        ).toFixed(2)}
                      </p>
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

        {/* 6. Tabla de costos heredados */}
        {selectedCategory && (
          <div className="form-section">
            <h2 className="section-label">Costos heredados de &quot;{selectedCategory.name}&quot;</h2>
            <table className="table" style={{ marginBottom: pricedVariantAttrs.length === 0 ? 14 : 0 }}>
              <thead>
                <tr>
                  <th>Logística</th>
                  <th>Envío</th>
                  <th>Seguridad</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${logisticsCostPreview.toFixed(2)}</td>
                  <td>${shippingCostPreview.toFixed(2)}</td>
                  <td>${securityCostPreview.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {pricedVariantAttrs.length === 0 ? (
              <>
                <div className="grid-2" style={{ marginBottom: 10 }}>
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
                <p style={{ margin: 0, fontWeight: 600 }}>
                  Precio $ = Precio de compra + costos + utilidad = ${pricePreview.toFixed(2)}
                </p>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                El precio de compra y la utilidad se cargan por variante (sección Atributos, arriba).
              </p>
            )}
          </div>
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
    </div>
  );
}
