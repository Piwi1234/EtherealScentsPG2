"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, createCombo, getCategories, getProducts, getProductsStockSummary, updateCombo, uploadComboImage, type ProductStock } from "../../../lib/api";
import { productImageSrc } from "../../../lib/catalog-display";
import type { Category, Combo, Product, ProductVariant } from "../../../lib/types";
import { StockCell } from "../../../components/StockCell";
import { formatAtributosVisibles } from "../../../components/proformas/AtributosVisibles";

const PRODUCTOS_POR_PAGINA = 20;

type Elegido = {
  varianteId: string;
  cantidad: number;
  nombre: string;
  etiqueta: string | null;
  precioUnitarioBs: number;
  stock: number | null;
};

function bs(n: number): string {
  return `Bs ${n.toFixed(2)}`;
}

/** Precio final de una variante: la auto-provista (productos simples) toma el precio del producto. */
function precioDe(product: Product, variant: ProductVariant): number {
  return variant.isDefault ? product.finalPriceBs : variant.finalPriceBs;
}

function etiquetaDe(variant: ProductVariant): string | null {
  const e = variant.options.map((o) => o.optionValue.value).join(" · ");
  return e || null;
}

/** Atributos de la fila, como en la proforma: lo que distingue a la variante (ej. "Tamaño: 90 ML") y los atributos marcados para proforma. */
function atributosDe(product: Product, variant: ProductVariant): string {
  const propios = variant.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(product.attributeValues, product.variantOptionValues);
  return [...propios, ...(heredados ? [heredados] : [])].join(", ") || "—";
}

/**
 * Alta y edición de un combo: se elige la categoría, se buscan y agregan de 2 a 4 productos (cada uno con su cantidad), se fija
 * el descuento fijo en Bs y se sube la imagen. A la derecha, vista previa en vivo con la suma, el descuento, el total y el ahorro.
 */
export function ComboForm({ combo }: { combo?: Combo }) {
  const router = useRouter();
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [nombre, setNombre] = useState(combo?.nombre ?? "");
  const [categoryId, setCategoryId] = useState(combo?.categoryId ?? "");
  const [descripcion, setDescripcion] = useState(combo?.descripcion ?? "");
  const [descuento, setDescuento] = useState(combo ? String(combo.descuentoBs) : "");
  const [publicado, setPublicado] = useState(combo?.publicado ?? false);
  const [elegidos, setElegidos] = useState<Elegido[]>(
    combo?.items.map((i) => ({
      varianteId: i.varianteId,
      cantidad: i.cantidad,
      nombre: i.producto.name,
      etiqueta: i.variante.etiqueta,
      precioUnitarioBs: i.precioUnitarioBs,
      stock: i.stockDisponible ?? null,
    })) ?? [],
  );
  const [imagen, setImagen] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Product[] | null>(null);
  // Tabla para elegir productos: 20 por página.
  const [pagina, setPagina] = useState(1);
  const [totalProductos, setTotalProductos] = useState(0);
  // Stock por producto y variante (disponible, reservado y en tránsito), igual que la tabla de Productos.
  const [stock, setStock] = useState<Record<string, ProductStock>>({});
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const inputImagen = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCategories()
      .then(setCategorias)
      .catch(() => {});
  }, []);

  // Con la categoría elegida, los productos que se pueden agregar son los de esa categoría (y sus subcategorías).
  useEffect(() => {
    if (!categoryId) {
      setResultados(null);
      return;
    }
    const t = setTimeout(() => {
      getProducts({ categoryId, search: busqueda.trim() || undefined, page: pagina, pageSize: PRODUCTOS_POR_PAGINA })
        .then((p) => {
          setResultados(p.items);
          setTotalProductos(p.total);
        })
        .catch(() => {
          setResultados([]);
          setTotalProductos(0);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [categoryId, busqueda, pagina]);

  // Otra categoría o otra búsqueda: se vuelve a la primera página.
  useEffect(() => {
    setPagina(1);
  }, [categoryId, busqueda]);

  useEffect(() => {
    if (!resultados || resultados.length === 0) {
      setStock({});
      return;
    }
    getProductsStockSummary(resultados.map((p) => p.id))
      .then(setStock)
      .catch(() => setStock({}));
  }, [resultados]);

  useEffect(() => {
    if (!imagen) {
      setImagenPreview(null);
      return;
    }
    const url = URL.createObjectURL(imagen);
    setImagenPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imagen]);

  // Categoría en dos pasos, como en Productos: primero la categoría y, si quieres acotar, la subcategoría. El combo queda en la
  // subcategoría elegida o, sin ella, en la categoría (sus productos pueden ser de cualquiera de sus subcategorías).
  const raices = useMemo(() => categorias.filter((c) => c.parentId === null).sort((a, b) => a.name.localeCompare(b.name)), [categorias]);
  const categoriaActual = categorias.find((c) => c.id === categoryId);
  const rootId = categoriaActual ? (categoriaActual.parentId ?? categoriaActual.id) : "";
  const subId = categoriaActual?.parentId ? categoriaActual.id : "";
  const subcategorias = useMemo(() => categorias.filter((c) => c.parentId === rootId).sort((a, b) => a.name.localeCompare(b.name)), [categorias, rootId]);

  const totalPaginas = Math.max(1, Math.ceil(totalProductos / PRODUCTOS_POR_PAGINA));
  const suma = elegidos.reduce((n, e) => n + e.precioUnitarioBs * e.cantidad, 0);
  const descuentoNum = Number(descuento) || 0;
  const total = Math.max(0, Math.round((suma - descuentoNum) * 100) / 100);
  const descuentoValido = descuentoNum >= 0 && descuentoNum < suma;

  function cambiarCategoria(id: string) {
    if (elegidos.length > 0 && id !== categoryId && !confirm("Cambiar la categoría vacía los productos ya elegidos. ¿Seguir?")) return;
    if (id !== categoryId) setElegidos([]);
    setCategoryId(id);
  }

  function agregar(product: Product, variant: ProductVariant) {
    if (elegidos.some((e) => e.varianteId === variant.id)) return;
    if (elegidos.length >= 4) {
      setError("Un combo lleva como máximo 4 productos distintos. Para llevar más unidades de uno, sube su cantidad.");
      return;
    }
    setError("");
    setElegidos((prev) => [
      ...prev,
      {
        varianteId: variant.id,
        cantidad: 1,
        nombre: product.name,
        etiqueta: etiquetaDe(variant),
        precioUnitarioBs: precioDe(product, variant),
        stock: variant.stockDisponible ?? null,
      },
    ]);
  }

  async function guardar() {
    setError("");
    if (!nombre.trim()) return setError("Ponle un nombre al combo.");
    if (!categoryId) return setError("Elige la categoría del combo.");
    if (elegidos.length < 2) return setError("Un combo lleva entre 2 y 4 productos.");
    if (!descuentoValido) return setError(`El descuento tiene que ser menor que la suma de los productos (${bs(suma)}).`);
    setGuardando(true);
    try {
      const data = {
        nombre: nombre.trim(),
        categoryId,
        descripcion: descripcion.trim() || null,
        descuentoBs: descuentoNum,
        publicado,
        items: elegidos.map((e) => ({ varianteId: e.varianteId, cantidad: e.cantidad })),
      };
      const guardado = combo ? await updateCombo(combo.id, data) : await createCombo(data);
      if (imagen) await uploadComboImage(guardado.id, imagen);
      router.push("/dashboard/combos");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  }

  const imagenActual = imagenPreview ?? productImageSrc(combo?.imageUrl ?? null);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{combo ? `Editar combo · ${combo.comboCode}` : "Nuevo combo"}</h1>
        <Link href="/dashboard/combos" className="link-button">
          Volver
        </Link>
      </div>

      <div className="combo-form-grid">
        <div className="form-grid" style={{ alignContent: "start" }}>
          <div className="grid-2">
            <div>
              <label>Nombre del combo</label>
              <input className="field" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Dúo Árabes" />
            </div>
            <div className="grid-2">
              <div>
                <label>Categoría</label>
                <select className="field" value={rootId} onChange={(e) => cambiarCategoria(e.target.value)}>
                  <option value="">— Elegir —</option>
                  {raices.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Subcategoría</label>
                <select className="field" value={subId} onChange={(e) => cambiarCategoria(e.target.value || rootId)} disabled={!rootId || subcategorias.length === 0}>
                  <option value="">Todas</option>
                  {subcategorias.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label>Descripción (opcional)</label>
            <textarea className="field" rows={2} maxLength={1000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          <div>
            <label>Productos del combo ({elegidos.length} de 4)</label>
            {elegidos.length === 0 ? (
              <p className="cell-muted" style={{ fontSize: 13, margin: "4px 0" }}>Busca abajo y agrega de 2 a 4 productos.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {elegidos.map((e) => (
                  <div key={e.varianteId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cell-primary">{e.nombre}</div>
                      <div className="cell-muted" style={{ fontSize: 12 }}>
                        {e.etiqueta ? `${e.etiqueta} · ` : ""}
                        {bs(e.precioUnitarioBs)} c/u
                        {e.stock !== null && e.stock < e.cantidad && <span style={{ color: "#e5736a" }}> · stock {e.stock}</span>}
                      </div>
                    </div>
                    <span className="qty-stepper">
                      <button type="button" aria-label="Menos" disabled={e.cantidad <= 1} onClick={() => setElegidos((p) => p.map((x) => (x.varianteId === e.varianteId ? { ...x, cantidad: x.cantidad - 1 } : x)))}>
                        −
                      </button>
                      <input type="number" min={1} max={10} readOnly value={e.cantidad} aria-label={`Cantidad de ${e.nombre}`} />
                      <button type="button" aria-label="Más" disabled={e.cantidad >= 10} onClick={() => setElegidos((p) => p.map((x) => (x.varianteId === e.varianteId ? { ...x, cantidad: x.cantidad + 1 } : x)))}>
                        +
                      </button>
                    </span>
                    <span className="cell-primary" style={{ minWidth: 90, textAlign: "right" }}>{bs(e.precioUnitarioBs * e.cantidad)}</span>
                    <button type="button" className="action-btn danger" onClick={() => setElegidos((p) => p.filter((x) => x.varianteId !== e.varianteId))}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label>Agregar producto</label>
            <input
              className="field"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={categoryId ? "Buscar por nombre o marca..." : "Elige primero la categoría"}
              disabled={!categoryId}
            />
            {categoryId && resultados && resultados.length === 0 && <p className="cell-muted" style={{ fontSize: 13 }}>No hay productos con esa búsqueda en esta categoría.</p>}
            {resultados && resultados.length > 0 && (
              <div className="table-scroll" style={{ marginTop: 6 }}>
                <table className="table table-minimal table-compact">
                  <thead>
                    <tr>
                      <th>Stock</th>
                      <th>Marca</th>
                      <th style={{ minWidth: 180 }}>Nombre</th>
                      <th style={{ minWidth: 200 }}>Atributos</th>
                      <th className="num">Precio final Bs</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((p) =>
                      p.variants
                        .filter((v) => v.unidad !== "ML")
                        .map((v) => {
                          const ya = elegidos.some((e) => e.varianteId === v.id);
                          const st = stock[p.id]?.variantes[v.id];
                          return (
                            <tr key={v.id}>
                              <td>
                                <StockCell
                                  disponible={st?.disponible ?? v.stockDisponible ?? 0}
                                  reservado={st?.reservado ?? v.stockReservado ?? 0}
                                  transito={st ? st.disponibleTransito : undefined}
                                />
                              </td>
                              <td className="cell-muted">{p.brand?.name ?? "—"}</td>
                              <td className="cell-primary">{p.name}</td>
                              <td className="cell-muted">{atributosDe(p, v)}</td>
                              <td className="num cell-primary">
                                <span className="unit">Bs</span> {precioDe(p, v).toFixed(2)}
                              </td>
                              <td>
                                <button type="button" className="action-btn" disabled={ya || elegidos.length >= 4} onClick={() => agregar(p, v)}>
                                  {ya ? "Agregado" : "Agregar"}
                                </button>
                              </td>
                            </tr>
                          );
                        }),
                    )}
                  </tbody>
                </table>
                {totalPaginas > 1 && (
                  <div className="pagination">
                    <button type="button" className={`pagination-btn${pagina <= 1 ? " disabled" : ""}`} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                      ← Anterior
                    </button>
                    <span className="pagination-info">
                      Página {pagina} de {totalPaginas} · {totalProductos} productos
                    </span>
                    <button type="button" className={`pagination-btn${pagina >= totalPaginas ? " disabled" : ""}`} disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                      Siguiente →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="combo-form-side">
          <div className="combo-preview">
            <span className="combo-preview-label">Vista previa del precio</span>
            <div className="combo-preview-row"><span>Suma de los productos</span><span>{bs(suma)}</span></div>
            <label className="combo-preview-row" style={{ alignItems: "center" }}>
              <span>Descuento (Bs)</span>
              <input className="field" style={{ width: 110, textAlign: "right" }} type="number" min={0} step="0.01" value={descuento} onChange={(e) => setDescuento(e.target.value)} placeholder="0" />
            </label>
            <div className="combo-preview-total"><span>Precio del combo</span><strong>{bs(total)}</strong></div>
            {suma > 0 && descuentoNum > 0 && descuentoValido && (
              <p className="cell-muted" style={{ fontSize: 12, margin: 0 }}>
                El cliente ahorra {bs(descuentoNum)} ({((descuentoNum / suma) * 100).toFixed(1)}%).
              </p>
            )}
            {!descuentoValido && suma > 0 && <p className="error-text" style={{ fontSize: 12, margin: 0 }}>El descuento tiene que ser menor que la suma.</p>}
          </div>

          <div>
            <label>Imagen del combo</label>
            <div
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                border: "1px dashed var(--line)",
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                cursor: "pointer",
              }}
              onClick={() => inputImagen.current?.click()}
            >
              {imagenActual ? <img src={imagenActual} alt="Imagen del combo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span className="cell-muted">Subir imagen</span>}
            </div>
            <input ref={inputImagen} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={(e) => setImagen(e.target.files?.[0] ?? null)} />
            <button type="button" className="link-button" style={{ marginTop: 6 }} onClick={() => inputImagen.current?.click()}>
              {imagenActual ? "Cambiar imagen" : "Elegir imagen"}
            </button>
          </div>

          <label className="checkbox-row">
            <input type="checkbox" checked={publicado} onChange={(e) => setPublicado(e.target.checked)} />
            Publicar en la web
          </label>

          {error && <p className="error-text">{error}</p>}
          <button type="button" className="button" onClick={guardar} disabled={guardando} style={{ width: "100%", justifyContent: "center" }}>
            {guardando ? "Guardando..." : combo ? "Guardar cambios" : "Crear combo"}
          </button>
        </aside>
      </div>
    </div>
  );
}
