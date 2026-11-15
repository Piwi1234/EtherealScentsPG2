"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, crearCampana, getBrands, getCategories, vistaPreviaCampana } from "../../../../lib/api";
import type { Brand, Category, CampanaInput, CampanaVistaPrevia, TipoDescuentoCampana } from "../../../../lib/types";
import { Selector } from "../../../../components/stock/ExistenciasLista";
import { DESCRIPCION_CAMPANA_POR_DEFECTO } from "../../../../lib/campana";

type Alcance = "CATEGORIA" | "CODIGOS";

const bs = (n: number) => `Bs ${n.toLocaleString("es-BO", { maximumFractionDigits: 0 })}`;

/** Valor de un <input type="datetime-local"> ("2026-11-16T00:00") interpretado en la hora de la tienda (GMT-4) → ISO en UTC. */
function aIso(valor: string): string {
  return new Date(`${valor}:00-04:00`).toISOString();
}

/** "AAAA-MM-DDTHH:mm" para un día dado, a las HH:mm. */
function campoFecha(base: Date, dias: number, hora: string): string {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, "0")}T${hora}`;
}

/** Nueva campaña: qué productos, cuánto descuento y cuándo, con una vista previa en vivo de los precios antes de programarla. */
export default function NuevaCampanaPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [nombre, setNombre] = useState("BLACK FRIDAY");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<TipoDescuentoCampana>("PORCENTAJE");
  const [valor, setValor] = useState("20");
  const [alcanceTipo, setAlcanceTipo] = useState<Alcance>("CATEGORIA");
  const [rootId, setRootId] = useState("");
  const [subId, setSubId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [codigosTexto, setCodigosTexto] = useState("");
  const [excluirConDescuento, setExcluirConDescuento] = useState(true);
  const [soloDisponibles, setSoloDisponibles] = useState(true);
  const [usarPiso, setUsarPiso] = useState(true);
  const [margenPiso, setMargenPiso] = useState("5");
  // Por defecto: de mañana a 14 días después (ej. 16 → 30 de noviembre).
  const [inicio, setInicio] = useState(() => campoFecha(new Date(), 1, "00:00"));
  const [fin, setFin] = useState(() => campoFecha(new Date(), 15, "23:59"));

  const [vista, setVista] = useState<CampanaVistaPrevia | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
    getBrands().then(setBrands).catch(() => {});
  }, []);

  const raices = categories.filter((c) => c.parentId === null);
  const subcategorias = categories.filter((c) => c.parentId === rootId);
  const categoryId = alcanceTipo === "CATEGORIA" ? subId || rootId || undefined : undefined;
  const codigos = useMemo(() => codigosTexto.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean), [codigosTexto]);
  const marcasDisponibles = rootId ? brands.filter((b) => b.categories.some((bc) => bc.category.id === rootId || bc.category.parentId === rootId)) : brands;

  const solicitud = useMemo(() => {
    const valorNum = Number(valor);
    return {
      tipoDescuento: tipo,
      valor: tipo === "NINGUNO" ? undefined : valorNum,
      alcance: alcanceTipo === "CATEGORIA" ? { categoryId, brandIds: brandId ? [brandId] : [] } : { codigos },
      opciones: { excluirConDescuento, soloDisponibles, margenMinimoPct: usarPiso && margenPiso !== "" ? Number(margenPiso) : undefined },
    } satisfies Pick<CampanaInput, "tipoDescuento" | "valor" | "alcance" | "opciones">;
  }, [tipo, valor, alcanceTipo, categoryId, brandId, codigos, excluirConDescuento, soloDisponibles, usarPiso, margenPiso]);

  const alcanceListo = alcanceTipo === "CATEGORIA" ? Boolean(categoryId || brandId) : codigos.length > 0;
  const valorListo = tipo === "NINGUNO" || (Number(valor) > 0 && (tipo !== "PORCENTAJE" || Number(valor) <= 90));

  // Vista previa en vivo: se recalcula (con una pausa) cada vez que cambia algo del descuento.
  useEffect(() => {
    if (tipo === "NINGUNO" || !alcanceListo || !valorListo) {
      setVista(null);
      return;
    }
    let vigente = true;
    setCalculando(true);
    const t = setTimeout(() => {
      vistaPreviaCampana(solicitud)
        .then((v) => vigente && (setVista(v), setError("")))
        .catch((e) => vigente && setError(e instanceof ApiError ? e.message : String(e)))
        .finally(() => vigente && setCalculando(false));
    }, 600);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [solicitud, tipo, alcanceListo, valorListo]);

  async function guardar(programar: boolean) {
    if (!nombre.trim()) return setError("Ponle un nombre a la campaña.");
    if (tipo !== "NINGUNO" && !alcanceListo) return setError("Elige a qué productos se aplica.");
    if (!valorListo) return setError("Revisa el valor del descuento.");
    setGuardando(true);
    setError("");
    try {
      await crearCampana({ nombre: nombre.trim(), descripcion: descripcion.trim() || undefined, inicio: aIso(inicio), fin: aIso(fin), ...solicitud, programar });
      router.push("/dashboard/campanas");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  }

  const caja = { background: "var(--color-bg)", border: "1px solid var(--color-divider)", borderRadius: 14, padding: 16, display: "grid", gap: 10 } as const;
  const titulo = { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)", fontWeight: 600 } as const;

  return (
    <div className="card">
      <div className="ex-head">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 20 }}>Nueva campaña</h1>
          <p className="cell-muted" style={{ margin: 0, fontSize: 13, maxWidth: 720 }}>
            Aplica un descuento a muchos productos de una vez, con fecha de inicio y de fin. Empieza y termina sola, y se puede revertir con un clic.
          </p>
        </div>
        <Link href="/dashboard/campanas" className="link-button">
          ← Campañas
        </Link>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Formulario */}
        <div style={{ width: 440, maxWidth: "100%", display: "grid", gap: 16 }}>
          <div style={caja}>
            <div style={titulo}>1 · Qué productos</div>
            <div className="seg" role="group" aria-label="Cómo elegir los productos">
              <button type="button" className={alcanceTipo === "CATEGORIA" ? "on" : undefined} onClick={() => setAlcanceTipo("CATEGORIA")}>
                Categoría y marca
              </button>
              <button type="button" className={alcanceTipo === "CODIGOS" ? "on" : undefined} onClick={() => setAlcanceTipo("CODIGOS")}>
                Lista de códigos
              </button>
            </div>
            {alcanceTipo === "CATEGORIA" ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Selector etiqueta="Categoría" texto={raices.find((c) => c.id === rootId)?.name ?? "Elegir"} activo={Boolean(rootId)} valor={rootId} onChange={(v) => { setRootId(v); setSubId(""); setBrandId(""); }}>
                  <option value="">Todas</option>
                  {raices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Selector>
                <Selector etiqueta="Subcategoría" texto={subcategorias.find((c) => c.id === subId)?.name ?? "Todas"} activo={Boolean(subId)} valor={subId} onChange={setSubId} disabled={!rootId}>
                  <option value="">Todas</option>
                  {subcategorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Selector>
                <Selector etiqueta="Marca" texto={brands.find((b) => b.id === brandId)?.name ?? "Todas"} activo={Boolean(brandId)} valor={brandId} onChange={setBrandId}>
                  <option value="">Todas</option>
                  {marcasDisponibles.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Selector>
              </div>
            ) : (
              <div>
                <textarea
                  className="field"
                  rows={4}
                  value={codigosTexto}
                  onChange={(e) => setCodigosTexto(e.target.value)}
                  placeholder="Pega los códigos de producto, separados por espacio, coma o salto de línea"
                  aria-label="Códigos de producto"
                />
                <p className="cell-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>{codigos.length} código{codigos.length === 1 ? "" : "s"}</p>
              </div>
            )}
            <label className="checkbox-row">
              <input type="checkbox" checked={excluirConDescuento} onChange={(e) => setExcluirConDescuento(e.target.checked)} />
              Dejar fuera los que ya tienen descuento propio
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={soloDisponibles} onChange={(e) => setSoloDisponibles(e.target.checked)} />
              Dejar fuera los marcados como no disponibles
            </label>
          </div>

          <div style={caja}>
            <div style={titulo}>2 · Cuánto</div>
            <div className="seg" role="group" aria-label="Tipo de descuento">
              <button type="button" className={tipo === "PORCENTAJE" ? "on" : undefined} onClick={() => setTipo("PORCENTAJE")}>
                Porcentaje %
              </button>
              <button type="button" className={tipo === "MONTO" ? "on" : undefined} onClick={() => setTipo("MONTO")}>
                Monto Bs
              </button>
              <button type="button" className={tipo === "NINGUNO" ? "on" : undefined} onClick={() => setTipo("NINGUNO")}>
                Solo vitrina
              </button>
            </div>
            {tipo === "NINGUNO" ? (
              <p className="cell-muted" style={{ fontSize: 12.5, margin: 0 }}>
                No cambia ningún precio: solo muestra el nombre, las fechas y la cuenta regresiva en la tienda (para descuentos que cargas a mano).
              </p>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input className="field" type="number" min={0.01} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} style={{ width: 110 }} aria-label="Valor del descuento" />
                  <span className="cell-muted">{tipo === "PORCENTAJE" ? "%" : "Bs por unidad"}</span>
                </div>
                <label className="checkbox-row">
                  <input type="checkbox" checked={usarPiso} onChange={(e) => setUsarPiso(e.target.checked)} />
                  No dejar el precio por debajo del costo + margen de
                  <input className="field" type="number" min={0} max={500} value={margenPiso} disabled={!usarPiso} onChange={(e) => setMargenPiso(e.target.value)} style={{ width: 64, marginLeft: 6 }} aria-label="Margen mínimo" />%
                </label>
                <p className="cell-muted" style={{ fontSize: 12, margin: 0 }}>El precio final siempre sube al múltiplo de 5 más cercano, como en el catálogo.</p>
              </>
            )}
          </div>

          <div style={caja}>
            <div style={titulo}>3 · Cuándo y cómo se llama</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="filter-label">Empieza</label>
                <input className="field" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </div>
              <div>
                <label className="filter-label">Termina</label>
                <input className="field" type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="filter-label">Nombre (sale como pestaña y título en la tienda)</label>
              <input className="field" value={nombre} maxLength={40} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <label className="filter-label">Texto de la campaña (opcional)</label>
              <textarea className="field" rows={2} value={descripcion} maxLength={200} onChange={(e) => setDescripcion(e.target.value)} placeholder={DESCRIPCION_CAMPANA_POR_DEFECTO} />
              <p className="cell-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>Aparece debajo del nombre en el bloque del inicio y en la portada de la campaña. Vacío = el texto de siempre.</p>
            </div>
            <p className="cell-muted" style={{ fontSize: 12, margin: 0 }}>La hora es la de la tienda (GMT-4). Al terminar, los precios vuelven solos a lo que tenían.</p>
          </div>
        </div>

        {/* Vista previa */}
        <div style={{ flex: "1 1 520px", minWidth: 0, display: "grid", gap: 14 }}>
          {tipo === "NINGUNO" ? (
            <div style={caja}>
              <div style={titulo}>Vista previa</div>
              <p className="cell-muted" style={{ margin: 0 }}>Una campaña «solo vitrina» no cambia precios: no hay nada que previsualizar.</p>
            </div>
          ) : !alcanceListo || !valorListo ? (
            <div style={caja}>
              <div style={titulo}>Vista previa</div>
              <p className="cell-muted" style={{ margin: 0 }}>Elige a qué productos se aplica y cuánto: aquí verás cómo quedan los precios antes de programar nada.</p>
            </div>
          ) : (
            <>
              <div className="ex-kpis" style={{ marginBottom: 0 }}>
                <div><span>Productos afectados</span><strong>{vista ? vista.resumen.afectados : "…"}</strong></div>
                <div><span>Descuento promedio</span><strong>{vista?.resumen.descuentoPromedioPct != null ? `−${vista.resumen.descuentoPromedioPct}%` : "—"}</strong></div>
                <div><span>Margen promedio después</span><strong>{vista?.resumen.margenPromedioPct != null ? `${vista.resumen.margenPromedioPct}%` : "—"}</strong></div>
                <div>
                  <span>Con aviso</span>
                  <strong style={vista && vista.resumen.avisos > 0 ? { color: "#c9a96e" } : undefined}>{vista ? vista.resumen.avisos : "…"}</strong>
                  {vista && vista.resumen.excluidos > 0 && <small>{vista.resumen.excluidos} fuera</small>}
                </div>
              </div>

              <div className="ex-tabla" style={{ marginTop: 0, opacity: calculando ? 0.6 : 1 }}>
                <div className="table-scroll">
                  <table className="table table-minimal table-compact" style={{ minWidth: 640 }}>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className="num">Precio actual</th>
                        <th className="num">Descuento</th>
                        <th className="num">Precio nuevo</th>
                        <th className="num">Margen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(vista?.filas ?? []).map((f) => (
                        <tr key={`${f.productId}-${f.varianteId ?? ""}`} style={f.estado === "EXCLUIDO" ? { opacity: 0.5 } : f.estado === "AVISO" ? { background: "rgba(231, 185, 79, 0.07)" } : undefined}>
                          <td className="cell-primary">
                            <span className="cell-muted" style={{ display: "block", fontSize: 11.5, fontWeight: 400 }}>{f.marca ?? ""}</span>
                            {f.producto}
                            {f.etiqueta && <span className="cell-muted" style={{ fontWeight: 400 }}> · {f.etiqueta}</span>}
                            {f.motivo && <div style={{ fontSize: 12, fontWeight: 400, color: f.estado === "AVISO" ? "#e0c27a" : undefined }} className={f.estado === "EXCLUIDO" ? "cell-muted" : undefined}>{f.motivo}</div>}
                          </td>
                          <td className="num">{bs(f.precioActual)}</td>
                          <td className="num" style={{ color: f.estado === "EXCLUIDO" ? undefined : "#e5675b", fontWeight: 600 }}>{f.estado === "EXCLUIDO" ? "—" : `−${bs(f.precioLista - f.precioNuevo)}`}</td>
                          <td className="num"><strong>{bs(f.precioNuevo)}</strong></td>
                          <td className="num" style={{ color: f.margenPct != null && f.margenPct < 5 ? "#e0c27a" : "#3fb68b", fontWeight: 600 }}>{f.margenPct != null ? `${f.margenPct}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {vista && (
                <p className="cell-muted" style={{ fontSize: 12.5, margin: 0 }}>
                  Mostrando {vista.filas.length} de {vista.total} · los avisos primero.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {error && <p className="error-text" style={{ marginTop: 14 }}>{error}</p>}

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--color-divider)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span className="cell-muted" style={{ fontSize: 13 }}>
          Al programarla empezará el <strong style={{ color: "var(--color-text)" }}>{inicio.replace("T", " ")}</strong> y terminará el <strong style={{ color: "var(--color-text)" }}>{fin.replace("T", " ")}</strong>.
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="action-btn" disabled={guardando} onClick={() => guardar(false)}>
            Guardar borrador
          </button>
          <button type="button" className="button" disabled={guardando || (tipo !== "NINGUNO" && (calculando || !vista))} onClick={() => guardar(true)}>
            {guardando ? "Guardando..." : "Programar campaña"}
          </button>
        </div>
      </div>
    </div>
  );
}
