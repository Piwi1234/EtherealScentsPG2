"use client";

import { useEffect, useState } from "react";
import {
  addHistoriaSugerenciaProducto,
  apiGet,
  ApiError,
  getBrands,
  getProducts,
  moveHistoriaSugerenciaProducto,
  removeHistoriaSugerenciaProducto,
  setHistoriaSugerencia,
} from "../../../lib/api";
import type { Attribute, Brand, Category, HistoriaDetalle, HistoriaSugerenciaTipo, Product } from "../../../lib/types";

function reportError(e: unknown) {
  alert(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
}

const TIPOS: { value: HistoriaSugerenciaTipo | ""; label: string }[] = [
  { value: "", label: "Ninguna" },
  { value: "CASA", label: "Casa" },
  { value: "PERFUMES", label: "Perfumes" },
  { value: "PERFUMISTA", label: "Perfumista" },
  { value: "INGREDIENTE", label: "Ingrediente" },
];

// PERFUMES y PERFUMISTA comparten el mismo bloque de selección manual de productos — solo cambia el
// copy público ("Explora la Fragancia" vs "Explora sus Creaciones", ver HistoriaSugerenciaSection).
const TIPOS_CON_PRODUCTOS_MANUALES: (HistoriaSugerenciaTipo | "")[] = ["PERFUMES", "PERFUMISTA"];

export function HistoriaSugerenciaEditor({ historia, onChanged }: { historia: HistoriaDetalle; onChanged: () => void }) {
  const [tipo, setTipo] = useState<HistoriaSugerenciaTipo | "">(historia.sugerenciaTipo ?? "");
  const [brandId, setBrandId] = useState(historia.sugerenciaBrand?.id ?? "");
  const [attributeOptionId, setAttributeOptionId] = useState(historia.sugerenciaAttributeOption?.id ?? "");
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [acordeOptions, setAcordeOptions] = useState<Attribute["options"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [pickedProducts, setPickedProducts] = useState<Record<string, Product>>({});
  const [addingProductId, setAddingProductId] = useState<string | null>(null);

  useEffect(() => {
    getBrands().then(setBrands).catch(() => setBrands([]));

    // El atributo de acordes es el único allowMultiple de Perfumes — mismo criterio que ScentFinder
    // en home/page.tsx, no está hardcodeado por nombre.
    apiGet<Category[]>("/categories")
      .then((cats) => {
        const perfumes = cats.find((c) => c.parentId === null && c.slug === "perfumes");
        if (!perfumes) return;
        return apiGet<Attribute[]>(`/catalog/categories/${perfumes.id}/filters`).then((attrs) => {
          const acordes = attrs.find((a) => a.allowMultiple);
          setAcordeOptions(acordes?.options ?? []);
        });
      })
      .catch(() => setAcordeOptions([]));
  }, []);

  // Trae los datos (nombre, etc.) de los productos elegidos a mano que todavía no tenemos en caché.
  useEffect(() => {
    const missing = historia.sugerenciaProductos.map((sp) => sp.productId).filter((id) => !pickedProducts[id]);
    if (missing.length === 0) return;
    Promise.all(missing.map((id) => apiGet<Product>(`/products/${id}`).catch(() => null))).then((results) => {
      setPickedProducts((prev) => {
        const next = { ...prev };
        results.forEach((p, i) => {
          if (p) next[missing[i]] = p;
        });
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historia.sugerenciaProductos]);

  useEffect(() => {
    if (!TIPOS_CON_PRODUCTOS_MANUALES.includes(tipo) || productSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const handle = setTimeout(() => {
      getProducts({ search: productSearch.trim(), pageSize: 8 })
        .then((page) => setSearchResults(page.items))
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [productSearch, tipo]);

  async function handleSaveTipo() {
    setError("");
    if (tipo === "CASA" && !brandId) {
      setError("Elegí una marca.");
      return;
    }
    if (tipo === "INGREDIENTE" && !attributeOptionId) {
      setError("Elegí un acorde.");
      return;
    }
    setSaving(true);
    try {
      await setHistoriaSugerencia(historia.id, {
        tipo: tipo || null,
        brandId: tipo === "CASA" ? brandId : undefined,
        attributeOptionId: tipo === "INGREDIENTE" ? attributeOptionId : undefined,
      });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddProducto(productId: string) {
    setAddingProductId(productId);
    try {
      await addHistoriaSugerenciaProducto(historia.id, productId);
      setProductSearch("");
      setSearchResults([]);
      onChanged();
    } catch (e) {
      reportError(e);
    } finally {
      setAddingProductId(null);
    }
  }

  async function handleRemoveProducto(productId: string) {
    try {
      await removeHistoriaSugerenciaProducto(historia.id, productId);
      onChanged();
    } catch (e) {
      reportError(e);
    }
  }

  async function handleMoveProducto(productId: string, direction: "up" | "down") {
    try {
      await moveHistoriaSugerenciaProducto(historia.id, productId, direction);
      onChanged();
    } catch (e) {
      reportError(e);
    }
  }

  const sortedProductos = [...historia.sugerenciaProductos].sort((a, b) => a.orden - b.orden);
  const pickedIds = new Set(sortedProductos.map((sp) => sp.productId));

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Sugerencia al final de la historia</h2>
      <p className="cell-muted" style={{ fontSize: 12, margin: "0 0 16px" }}>
        Qué se muestra después de los bloques: una casa (sus últimos perfumes agregados), perfumes
        puntuales elegidos a mano, o un ingrediente/acorde (sus últimos perfumes agregados). Para
        historias de Aprende, dejá "Ninguna".
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
        {TIPOS.map((t) => (
          <label key={t.value || "ninguna"} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="radio"
              name="sugerencia-tipo"
              checked={tipo === t.value}
              onChange={() => setTipo(t.value)}
            />
            {t.label}
          </label>
        ))}
      </div>

      {tipo === "CASA" && (
        <div style={{ marginBottom: 16, maxWidth: 360 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Marca</label>
          <select className="field" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">— Elegí una marca —</option>
            {brands?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {tipo === "INGREDIENTE" && (
        <div style={{ marginBottom: 16, maxWidth: 360 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Acorde</label>
          <select className="field" value={attributeOptionId} onChange={(e) => setAttributeOptionId(e.target.value)}>
            <option value="">— Elegí un acorde —</option>
            {acordeOptions?.map((o) => (
              <option key={o.id} value={o.id}>{o.value}</option>
            ))}
          </select>
        </div>
      )}

      {!TIPOS_CON_PRODUCTOS_MANUALES.includes(tipo) && (
        <>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="button" disabled={saving} onClick={handleSaveTipo}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </>
      )}

      {TIPOS_CON_PRODUCTOS_MANUALES.includes(tipo) && (
        <div>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions" style={{ justifyContent: "flex-start", marginBottom: 16 }}>
            <button type="button" className="button" disabled={saving} onClick={handleSaveTipo}>
              {saving ? "Guardando..." : "Guardar tipo"}
            </button>
          </div>

          {sortedProductos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {sortedProductos.map((sp, i) => {
                const p = pickedProducts[sp.productId];
                return (
                  <div
                    key={sp.productId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 13.5 }}>{p ? p.name : "Cargando..."}</span>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="action-btn"
                        disabled={i === 0}
                        onClick={() => handleMoveProducto(sp.productId, "up")}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        disabled={i === sortedProductos.length - 1}
                        onClick={() => handleMoveProducto(sp.productId, "down")}
                      >
                        ↓
                      </button>
                      <button type="button" className="action-btn danger" onClick={() => handleRemoveProducto(sp.productId)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ position: "relative", maxWidth: 360 }}>
            <input
              className="field"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar producto por nombre..."
            />
            {searchResults.filter((p) => !pickedIds.has(p.id)).length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  background: "var(--surface, #fff)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  marginTop: 4,
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {searchResults
                  .filter((p) => !pickedIds.has(p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={addingProductId === p.id}
                      onClick={() => handleAddProducto(p.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 12px",
                        fontSize: 13,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
