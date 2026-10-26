"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, getBrands, getCategories, getEmpresas, getProducts, getProveedores, getRegistros } from "../../../lib/api";
import type { Brand, Category, Empresa, Product, Proveedor, RegistroLinea, RegistroResumen, TipoProforma } from "../../../lib/types";
import { NuevaProformaBoton } from "../../../components/proformas/NuevaProformaBoton";
import { EstadoBadge } from "../../../components/proformas/EstadoBadge";
import { formatAtributosVisibles } from "../../../components/proformas/AtributosVisibles";
import { DateRangeDropdown, type DateSelection } from "../../../components/DateRangeDropdown";
import { ProductoSearchSelect } from "../../../components/proformas/ProductoSearchSelect";
import { ClienteBuscador } from "../../../components/proformas/ClienteBuscador";
import { ProveedorSelector } from "../../../components/proformas/selectors";

type TabRegistros = TipoProforma | "SIN_CONCRETAR";

const ETIQUETA_ESTADO = { "": "", BORRADOR: "Borradores", APROBADA: "Aprobadas", COMPLETADA: "Completadas", ANULADA: "Anuladas" } as const;

/** Días enteros desde una fecha ISO hasta hoy. */
function diasDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

/** Contexto de una proforma sin concretar: borrador → quién la creó y hace cuánto; anulada → quién y por qué. */
function detalleSinConcretar(proforma: RegistroLinea["proforma"]): string {
  if (proforma.estado === "ANULADA") {
    const anulacion = proforma.historial[0];
    const quien = anulacion?.usuario.nombre ?? "—";
    return `Anulada por ${quien}${anulacion?.nota ? ` — "${anulacion.nota}"` : ""}`;
  }
  const dias = diasDesde(proforma.createdAt);
  return `Creada por ${proforma.creadoPor.nombre} · hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

const PAGE_SIZE = 20;
const TODO_EL_TIEMPO: DateSelection = { label: "Todo el tiempo" };

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function money(value: number | null, prefix = "Bs"): string {
  return value === null ? "—" : `${prefix} ${value.toFixed(2)}`;
}

type RegistrosData = { items: RegistroLinea[]; total: number; page: number; pageSize: number; resumen: RegistroResumen };

/** Precio/costo unitario en Bs de una línea. En compras se convierte con el tipo de cambio de su proforma (null si no tiene). */
function unitarioBs(linea: RegistroLinea, tipo: TipoProforma): number | null {
  if (tipo === "VENTA") return Number(linea.precioUnitario ?? 0);
  const tc = linea.proforma.tipoCambioProf ? Number(linea.proforma.tipoCambioProf) : null;
  if (!tc) return null;
  const usd = Number(linea.precioCompra ?? 0) + Number(linea.costoEnvio ?? 0) + Number(linea.costoSeguridad ?? 0) + Number(linea.costoLogistica ?? 0);
  return usd * tc;
}

function subtotalBs(linea: RegistroLinea, tipo: TipoProforma): number | null {
  if (tipo === "VENTA") return Number(linea.subtotal);
  const tc = linea.proforma.tipoCambioProf ? Number(linea.proforma.tipoCambioProf) : null;
  return tc ? Number(linea.subtotal) * tc : null;
}

/** Suma de subtotales en Bs; null si alguno no se pudo convertir. */
function sumaBs(valores: (number | null)[]): number | null {
  return valores.some((v) => v === null) ? null : valores.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

type EntregaFiltro = "" | "LISTA" | "ESPERANDO";

/** Entrega de una venta aprobada: con faltante, reservada en tránsito o lista para completar. */
function EntregaResumen({ entrega }: { entrega: NonNullable<RegistroLinea["proforma"]["entrega"]> }) {
  if (entrega.faltante > 0) return <span className="badge badge-warn entrega-badge" title="Hay productos sin stock: falta comprarlos o esperar que lleguen.">Con faltante · {entrega.faltante}</span>;
  if (entrega.transito > 0) return <span className="badge badge-info entrega-badge" title="Reservada contra mercadería que viaja en un envío.">Enviado · {entrega.transito}</span>;
  return <span className="badge badge-lista entrega-badge" title="Todo está reservado en stock físico: se puede completar.">Lista para completar</span>;
}

/** Avance de una compra aprobada: Comprado, Recogido, Enviado o Recibido, con cuántas unidades van. */
function AvanceCompra({ avance }: { avance: NonNullable<RegistroLinea["proforma"]["avance"]> }) {
  const { cantidad, recogido, enviado, recibido } = avance;
  if (recibido >= cantidad) return <span className="badge badge-success">Recibido</span>;
  if (recibido > 0) return <span className="badge badge-info">Recibido · {recibido} de {cantidad}</span>;
  if (enviado > 0) return <span className="badge badge-accent">Enviado · {enviado} de {cantidad}</span>;
  if (recogido > 0) return <span className="badge badge-info">Recogido · {recogido} de {cantidad}</span>;
  return <span className="badge badge-accent">Comprado</span>;
}

function atributosLabel(variante: RegistroLinea["variante"]): string | null {
  const opciones = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(variante.product.attributeValues, variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

/**
 * Dos pestañas (Ventas por defecto / Compras) dentro de la misma página. Cada pestaña es su propio
 * panel con sus filtros (fecha, categoría, marca, producto, código y cliente/proveedor): al cambiar
 * de pestaña no se pierde lo que se había filtrado en la otra. Un panel recién carga datos la
 * primera vez que se abre.
 */
/** "Tamaño: 100 ML, Concentracion: Eau de Parfum" → "100 ML · Eau de Parfum" (el nombre del atributo queda en el tooltip). */
function atributosCompactos(label: string | null): string {
  if (!label) return "—";
  return label
    .split(", ")
    .map((parte) => (parte.includes(": ") ? parte.split(": ").slice(1).join(": ") : parte))
    .join(" · ");
}

export default function RegistrosPage() {
  return (
    <Suspense fallback={<div className="card"><p className="cell-muted">Cargando...</p></div>}>
      <RegistrosContenido />
    </Suspense>
  );
}

const TABS_VALIDAS: TabRegistros[] = ["VENTA", "COMPRA", "SIN_CONCRETAR"];

function RegistrosContenido() {
  const params = useSearchParams();
  const tabInicial = TABS_VALIDAS.find((t) => t === params.get("tab")) ?? "VENTA";
  const estadoInicial = (["BORRADOR", "APROBADA", "COMPLETADA", "ANULADA"] as const).find((e) => e === params.get("estado")) ?? "";
  const entregaInicial: EntregaFiltro = params.get("entrega") === "LISTA" ? "LISTA" : params.get("entrega") === "ESPERANDO" ? "ESPERANDO" : "";
  const [tab, setTab] = useState<TabRegistros>(tabInicial);
  const [visitadas, setVisitadas] = useState<TabRegistros[]>([tabInicial]);
  const [empresaId, setEmpresaId] = useState("");
  useEffect(() => {
    getEmpresas({ pageSize: 100 })
      .then((page) => {
        const activas = page.items.filter((e: Empresa) => e.activo);
        setEmpresaId((activas.find((e: Empresa) => e.tipo === "CASA_MATRIZ") ?? activas[0])?.id ?? "");
      })
      .catch(() => {});
  }, []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getCategories().then(setCategories).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getBrands().then(setBrands).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  function elegirTab(t: TabRegistros) {
    try {
      sessionStorage.setItem("registros:tab", t);
    } catch {
      // sin sessionStorage: "Volver" desde una proforma cae en Ventas
    }
    setTab(t);
    setVisitadas((v) => (v.includes(t) ? v : [...v, t]));
  }

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="seg" role="tablist">
          {(["VENTA", "COMPRA", "SIN_CONCRETAR"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "on" : undefined}
              onClick={() => elegirTab(t)}
            >
              {t === "VENTA" ? "Ventas" : t === "COMPRA" ? "Compras" : "Sin concretar"}
            </button>
          ))}
        </div>
        <h1 style={{ margin: 0, fontSize: 20 }}>Registros</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <NuevaProformaBoton tipo="VENTA" empresaId={empresaId} />
          <NuevaProformaBoton tipo="COMPRA" empresaId={empresaId} />
        </div>
      </div>

      {visitadas.map((t) => (
        <div key={t} hidden={tab !== t}>
          <RegistrosPanel tab={t} activo={tab === t} categories={categories} brands={brands} estadoInicial={t === tabInicial ? estadoInicial : ""} entregaInicial={t === tabInicial ? entregaInicial : ""} />
        </div>
      ))}
    </div>
  );
}

function RegistrosPanel({
  tab,
  activo,
  categories,
  brands,
  estadoInicial,
  entregaInicial,
}: {
  tab: TabRegistros;
  activo: boolean;
  categories: Category[];
  brands: Brand[];
  estadoInicial: "" | "BORRADOR" | "APROBADA" | "COMPLETADA" | "ANULADA";
  entregaInicial: EntregaFiltro;
}) {
  // "Sin concretar" lista borradores y anuladas (lo que no pasó a ser real); ahí el tipo se elige adentro.
  const sinConcretar = tab === "SIN_CONCRETAR";
  const [tipoElegido, setTipoElegido] = useState<TipoProforma>("VENTA");
  const tipo: TipoProforma = sinConcretar ? tipoElegido : tab;
  const [dateSelection, setDateSelection] = useState<DateSelection>(TODO_EL_TIEMPO);
  const [products, setProducts] = useState<Product[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [productId, setProductId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [codigoInput, setCodigoInput] = useState("");
  const [codigo, setCodigo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [estado, setEstado] = useState<"" | "BORRADOR" | "APROBADA" | "COMPLETADA" | "ANULADA">(estadoInicial);
  const [entrega, setEntrega] = useState<EntregaFiltro>(entregaInicial);
  // Nombres para los chips de filtros activos, y claves para reiniciar los controles que guardan su propio estado.
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteKey, setClienteKey] = useState(0);
  const [dateKey, setDateKey] = useState(0);
  // Proformas abiertas (por id): por defecto todas plegadas, se abren con un clic en su encabezado.
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  const [data, setData] = useState<RegistrosData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const parentCategories = categories.filter((c) => c.parentId === null);
  const subCategoryIds = categories.filter((c) => c.parentId === categoryId).map((c) => c.id);
  const marcasDisponibles = brands.filter((b) => b.categories.some((bc) => subCategoryIds.includes(bc.categoryId)));

  useEffect(() => {
    if (tipo !== "COMPRA") return;
    getProveedores({ activo: "true", pageSize: 500 })
      .then((page) => setProveedores(page.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [tipo]);

  useEffect(() => {
    if (!categoryId) {
      setProducts([]);
      return;
    }
    getProducts({ categoryId, brandId: brandId || undefined, pageSize: 200 })
      .then((page) => setProducts(page.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [categoryId, brandId]);

  // Búsqueda con debounce: espera a que el usuario deje de tipear antes de disparar el pedido.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCodigo(codigoInput.trim());
      setPageNum(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [codigoInput]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPageNum(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!activo) return;
    setLoading(true);
    getRegistros({
      tipo,
      estado: estado || undefined,
      sinConcretar: sinConcretar || undefined,
      entrega: tipo === "VENTA" && !sinConcretar ? entrega || undefined : undefined,
      codigo: codigo || undefined,
      search: search || undefined,
      fechaDesde: dateSelection.fechaDesde,
      fechaHasta: dateSelection.fechaHasta,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      productId: productId || undefined,
      clienteId: tipo === "VENTA" ? clienteId || undefined : undefined,
      proveedorId: tipo === "COMPRA" ? proveedorId || undefined : undefined,
      page: pageNum,
      limit: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [activo, tipo, sinConcretar, estado, entrega, codigo, search, dateSelection, categoryId, brandId, productId, clienteId, proveedorId, pageNum]);

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setBrandId("");
    setProductId("");
    setPageNum(1);
  }

  function handleBrandChange(value: string) {
    setBrandId(value);
    setProductId("");
    setPageNum(1);
  }

  function handleProductChange(value: string) {
    setProductId(value);
    setPageNum(1);
  }

  function handleDateApply(selection: DateSelection) {
    setDateSelection(selection);
    setPageNum(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  // Líneas de la página agrupadas por proforma (el backend las entrega contiguas).
  const grupos: { proforma: RegistroLinea["proforma"]; lineas: RegistroLinea[] }[] = [];
  for (const linea of data?.items ?? []) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.proforma.id === linea.proforma.id) ultimo.lineas.push(linea);
    else grupos.push({ proforma: linea.proforma, lineas: [linea] });
  }

  function elegirEstado(valor: "" | "BORRADOR" | "APROBADA" | "COMPLETADA" | "ANULADA") {
    setEstado(valor);
    setPageNum(1);
  }

  function alternarGrupo(id: string) {
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const todasAbiertas = grupos.length > 0 && grupos.every((g) => abiertas.has(g.proforma.id));

  function quitarCategoria() {
    handleCategoryChange("");
  }

  function limpiarTodo() {
    setSearchInput("");
    setCodigoInput("");
    setEstado("");
    setEntrega("");
    setDateSelection(TODO_EL_TIEMPO);
    setDateKey((k) => k + 1);
    setCategoryId("");
    setBrandId("");
    setProductId("");
    setClienteId("");
    setClienteNombre("");
    setClienteKey((k) => k + 1);
    setProveedorId("");
    setPageNum(1);
  }

  // Un chip por cada filtro activo, con su botón para quitarlo.
  const chips: { key: string; label: string; quitar: () => void }[] = [];
  if (search) chips.push({ key: "search", label: `Búsqueda: ${search}`, quitar: () => setSearchInput("") });
  if (estado) chips.push({ key: "estado", label: ETIQUETA_ESTADO[estado], quitar: () => elegirEstado("") });
  if (entrega) chips.push({ key: "entrega", label: entrega === "LISTA" ? "Lista para completar" : "Esperando mercadería", quitar: () => { setEntrega(""); setPageNum(1); } });
  if (codigo) chips.push({ key: "codigo", label: `Código: ${codigo}`, quitar: () => setCodigoInput("") });
  if (dateSelection.fechaDesde || dateSelection.fechaHasta) {
    chips.push({
      key: "fecha",
      label: dateSelection.label,
      quitar: () => {
        handleDateApply(TODO_EL_TIEMPO);
        setDateKey((k) => k + 1);
      },
    });
  }
  if (clienteId) {
    chips.push({
      key: "cliente",
      label: `Cliente: ${clienteNombre || "…"}`,
      quitar: () => {
        setClienteId("");
        setClienteNombre("");
        setClienteKey((k) => k + 1);
        setPageNum(1);
      },
    });
  }
  if (proveedorId) {
    chips.push({
      key: "proveedor",
      label: `Proveedor: ${proveedores.find((p) => p.id === proveedorId)?.nombre ?? "…"}`,
      quitar: () => {
        setProveedorId("");
        setPageNum(1);
      },
    });
  }
  if (categoryId) {
    chips.push({ key: "categoria", label: `Categoría: ${categories.find((c) => c.id === categoryId)?.name ?? "…"}`, quitar: quitarCategoria });
  }
  if (brandId) {
    chips.push({ key: "marca", label: `Marca: ${brands.find((b) => b.id === brandId)?.name ?? "…"}`, quitar: () => handleBrandChange("") });
  }
  if (productId) {
    chips.push({ key: "producto", label: `Producto: ${products.find((p) => p.id === productId)?.name ?? "…"}`, quitar: () => handleProductChange("") });
  }

  if (error) return <p className="error-text">{error}</p>;

  return (
    <>
      <div className="filters-bar">
        {sinConcretar && (
          <div className="filter-field">
            <label className="filter-label">Tipo</label>
            <div className="seg" role="group" aria-label="Tipo de proforma">
              {(
                [
                  ["VENTA", "Ventas"],
                  ["COMPRA", "Compras"],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  className={tipoElegido === valor ? "on" : undefined}
                  onClick={() => {
                    setTipoElegido(valor);
                    setPageNum(1);
                  }}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="filter-field">
          <label className="filter-label">Estado</label>
          <div className="seg" role="group" aria-label="Estado de la proforma">
            {(
              (sinConcretar
                ? [
                    ["", "Todas"],
                    ["BORRADOR", "Borradores"],
                    ["ANULADA", "Anuladas"],
                  ]
                : [
                    ["", "Todas"],
                    ["APROBADA", "Aprobadas"],
                    ["COMPLETADA", "Completadas"],
                  ]) as ["" | "BORRADOR" | "APROBADA" | "COMPLETADA" | "ANULADA", string][]
            ).map(([valor, etiqueta]) => (
              <button key={valor} type="button" className={estado === valor ? "on" : undefined} onClick={() => elegirEstado(valor)}>
                {etiqueta}
              </button>
            ))}
          </div>
        </div>

        {tipo === "VENTA" && !sinConcretar && (
          <div className="filter-field">
            <label className="filter-label">Entrega</label>
            <div className="seg" role="group" aria-label="Entrega de la venta">
              {(
                [
                  ["", "Todas"],
                  ["LISTA", "Lista para completar"],
                  ["ESPERANDO", "Esperando mercadería"],
                ] as [EntregaFiltro, string][]
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  className={entrega === valor ? "on" : undefined}
                  onClick={() => {
                    setEntrega(valor);
                    setPageNum(1);
                  }}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="filter-field" style={{ minWidth: 220, flex: 1 }}>
          <label className="filter-label">Producto o marca</label>
          <input
            className="field"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Nombre o marca"
          />
        </div>

        <div className="filter-field">
          <label className="filter-label">Código proforma</label>
          <input
            className="field"
            placeholder="Ej. 4HRNPZW"
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value)}
            style={{ width: 130 }}
          />
        </div>

        {tipo === "VENTA" ? (
          <div className="filter-field" style={{ minWidth: 200 }}>
            <label className="filter-label">Cliente</label>
            <ClienteBuscador
              key={clienteKey}
              value={clienteId}
              onChange={(cliente) => {
                setClienteId(cliente?.id ?? "");
                setClienteNombre(cliente?.nombre ?? "");
                setPageNum(1);
              }}
            />
          </div>
        ) : (
          <div className="filter-field" style={{ minWidth: 200 }}>
            <label className="filter-label">Proveedor</label>
            <ProveedorSelector
              options={proveedores}
              value={proveedorId}
              placeholder="Todos"
              onChange={(id) => {
                setProveedorId(id);
                setPageNum(1);
              }}
            />
          </div>
        )}

        <DateRangeDropdown key={dateKey} onApply={handleDateApply} />

        <div className="filter-field">
          <label className="filter-label">Categoría</label>
          <select className="field" value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
            <option value="">Todas</option>
            {parentCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {categoryId && (
          <div className="filter-field">
            <label className="filter-label">Marca</label>
            <select className="field" value={brandId} onChange={(e) => handleBrandChange(e.target.value)}>
              <option value="">Todas</option>
              {marcasDisponibles.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {categoryId && (
          <div className="filter-field">
            <label className="filter-label">Producto</label>
            <ProductoSearchSelect products={products} value={productId} onChange={handleProductChange} />
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div className="reg-chips">
          {chips.map((c) => (
            <span key={c.key} className="reg-chip">
              {c.label}
              <button type="button" aria-label={`Quitar ${c.label}`} onClick={c.quitar}>
                ×
              </button>
            </span>
          ))}
          <button type="button" className="link-button" onClick={limpiarTodo}>
            Limpiar todo
          </button>
        </div>
      )}

      {data && sinConcretar && (
        <div className="reg-kpis">
          <div className="dash-kpi">
            <span className="dash-kpi-label">En cotización (borradores)</span>
            <span className="dash-kpi-value">{money(data.resumen.porEstado.BORRADOR?.totalBs ?? 0)}</span>
            <span className="dash-kpi-note">{data.resumen.porEstado.BORRADOR?.proformas ?? 0} proformas sin aprobar</span>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">{tipo === "VENTA" ? "Ventas anuladas" : "Compras anuladas"}</span>
            <span className="dash-kpi-value">{money(data.resumen.porEstado.ANULADA?.totalBs ?? 0)}</span>
            <span className="dash-kpi-note">{data.resumen.porEstado.ANULADA?.proformas ?? 0} proformas</span>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">Piezas</span>
            <span className="dash-kpi-value">{data.resumen.piezas}</span>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">Proformas</span>
            <span className="dash-kpi-value">{data.resumen.proformas}</span>
          </div>
        </div>
      )}

      {data && !sinConcretar && (
        <div className="reg-kpis">
          <div className="dash-kpi">
            <span className="dash-kpi-label">{tipo === "VENTA" ? "Total vendido" : "Total comprado"}</span>
            <span className="dash-kpi-value">{money(data.resumen.totalBs)}</span>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">Piezas</span>
            <span className="dash-kpi-value">{data.resumen.piezas}</span>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">Proformas</span>
            <span className="dash-kpi-value">{data.resumen.proformas}</span>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">{tipo === "VENTA" ? "Ticket promedio" : "Compra promedio"}</span>
            <span className="dash-kpi-value">
              {data.resumen.proformas > 0 ? money(data.resumen.totalBs / data.resumen.proformas) : "—"}
            </span>
          </div>
        </div>
      )}

      {loading && <p className="cell-muted">Cargando...</p>}

      {!loading && data && data.items.length === 0 && <p>No hay registros para estos filtros.</p>}

      {!loading && data && data.items.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
            <button
              type="button"
              className="link-button"
              onClick={() => setAbiertas(todasAbiertas ? new Set() : new Set(grupos.map((g) => g.proforma.id)))}
            >
              {todasAbiertas ? "Contraer todo" : "Expandir todo"}
            </button>
          </div>
          <div className="table-scroll">
            <table className="table table-minimal table-compact">
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>Proforma / marca</th>
                  <th style={{ minWidth: 200 }}>Producto</th>
                  <th>Atributos</th>
                  <th className="num">Cant.</th>
                  <th className="num">{tipo === "COMPRA" ? "Costo unitario Bs" : "Precio unitario Bs"}</th>
                  <th className="num">Subtotal Bs</th>
                  {tipo === "COMPRA" && <th>Proveedor</th>}
                  {tipo === "COMPRA" && <th>País de origen</th>}
                  {tipo === "VENTA" && <th className="num">Pagado Bs</th>}
                  {tipo === "VENTA" && <th className="num">Saldo Bs</th>}
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => {
                  const subtotalGrupo = sumaBs(g.lineas.map((l) => subtotalBs(l, tipo)));
                  return (
                    <Fragment key={g.proforma.id}>
                      <tr
                        className="reg-group"
                        onClick={() => alternarGrupo(g.proforma.id)}
                        aria-expanded={abiertas.has(g.proforma.id)}
                      >
                        <td className="reg-group-code">
                          <span className="reg-chevron">{abiertas.has(g.proforma.id) ? "▾" : "▸"}</span>
                          <Link
                            href={`/dashboard/proformas/${g.proforma.id}`}
                            className="link-button"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {g.proforma.codigo}
                          </Link>
                        </td>
                        <td className="cell-muted" style={{ fontWeight: 400 }}>
                          {formatDate(g.proforma.fecha)}
                          {tipo === "VENTA" && ` · ${g.proforma.cliente?.nombre ?? "Sin cliente"}`}
                          {g.proforma.almacen && ` · ${g.proforma.almacen.nombre}`}
                          {sinConcretar && ` · ${detalleSinConcretar(g.proforma)}`}
                          {!abiertas.has(g.proforma.id) && ` · ${g.lineas.length} producto${g.lineas.length === 1 ? "" : "s"}`}
                        </td>
                        <td>
                          <EstadoBadge estado={g.proforma.estado} />
                          {g.proforma.entrega && (
                            <div style={{ marginTop: 2 }}>
                              <EntregaResumen entrega={g.proforma.entrega} />
                            </div>
                          )}
                          {g.proforma.estado === "APROBADA" && g.proforma.avance && (
                            <div style={{ marginTop: 2 }}>
                              <AvanceCompra avance={g.proforma.avance} />
                            </div>
                          )}
                        </td>
                        <td colSpan={2} />
                        <td className="num">{money(subtotalGrupo)}</td>
                        {tipo === "COMPRA" && <td colSpan={2} />}
                        {tipo === "VENTA" && (
                          <>
                            <td className="num">{g.proforma.pagado !== undefined && g.proforma.estado !== "BORRADOR" ? money(g.proforma.pagado) : "—"}</td>
                            <td className="num">
                              {g.proforma.total !== undefined && g.proforma.pagado !== undefined && g.proforma.estado !== "BORRADOR"
                                ? money(Math.max(0, Math.round((g.proforma.total - g.proforma.pagado) * 100) / 100))
                                : "—"}
                            </td>
                          </>
                        )}
                      </tr>
                      {abiertas.has(g.proforma.id) && g.lineas.map((linea) => {
                        const etiqueta = atributosLabel(linea.variante);
                        return (
                          <tr key={linea.id}>
                            <td className="reg-indent cell-muted">{linea.variante.product.brand?.name ?? "—"}</td>
                            <td className="cell-primary">{linea.variante.product.name}</td>
                            <td className="cell-muted" title={etiqueta ?? undefined}>
                              {atributosCompactos(etiqueta)}
                            </td>
                            <td className="num">{linea.cantidad}</td>
                            <td className="num cell-muted">{money(unitarioBs(linea, tipo))}</td>
                            <td className="num">{money(subtotalBs(linea, tipo))}</td>
                            {tipo === "COMPRA" && <td className="cell-muted">{linea.proveedor?.nombre ?? "—"}</td>}
                            {tipo === "COMPRA" && <td>{linea.proveedor?.paisProcedencia?.nombre ?? "—"}</td>}
                            {tipo === "VENTA" && <td colSpan={2} />}
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
                <tr className="reg-total">
                  <td colSpan={3}>Total de esta página</td>
                  <td className="num">{data.items.reduce((n, l) => n + l.cantidad, 0)}</td>
                  <td />
                  <td className="num">{money(sumaBs(data.items.map((l) => subtotalBs(l, tipo))))}</td>
                  {tipo === "COMPRA" && <td colSpan={2} />}
                  {tipo === "VENTA" && <td colSpan={2} />}
                </tr>
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className={`pagination-btn${pageNum <= 1 ? " disabled" : ""}`}
                disabled={pageNum <= 1}
                onClick={() => setPageNum((p) => p - 1)}
              >
                ← Anterior
              </button>
              <span className="pagination-info">
                Página {pageNum} de {totalPages}
              </span>
              <button
                type="button"
                className={`pagination-btn${pageNum >= totalPages ? " disabled" : ""}`}
                disabled={pageNum >= totalPages}
                onClick={() => setPageNum((p) => p + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
