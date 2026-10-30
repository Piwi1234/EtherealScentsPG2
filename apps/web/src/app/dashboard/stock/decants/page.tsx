"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, darBajaMl, deshacerConversionDecant, getAlmacenes, getDecants, getMovimientosDecant } from "../../../../lib/api";
import type { Almacen, DecantResumen, MovimientoDecant, Page, ProbadorVariante } from "../../../../lib/types";
import { formatAtributosVisibles } from "../../../../components/proformas/AtributosVisibles";
import { Modal } from "../../../../components/Modal";

const PAGE_SIZE = 20;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-VE", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function atributosLabel(variante: ProbadorVariante): string | null {
  const opciones = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = formatAtributosVisibles(variante.product.attributeValues, variante.product.variantOptionValues);
  const partes = [...opciones, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? partes.join(", ") : null;
}

function Producto({ variante }: { variante: ProbadorVariante }) {
  const etiqueta = atributosLabel(variante);
  return (
    <>
      {variante.product.name}
      {etiqueta && <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{etiqueta}</div>}
    </>
  );
}

function usd(n: number | string): string {
  return `$ ${Number(n).toFixed(2)}`;
}

/**
 * Decants: los ml que hay ahora (de frascos convertidos) y el historial de conversiones y bajas de ml. Las conversiones se
 * hacen desde Existencias (botón "Decants" del producto).
 */
export default function DecantsPage() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacenId, setAlmacenId] = useState("");
  const [search, setSearch] = useState("");
  const [buscar, setBuscar] = useState("");
  const [resumen, setResumen] = useState<{ items: DecantResumen[]; totalMl: number } | null>(null);
  const [movs, setMovs] = useState<Page<MovimientoDecant> | null>(null);
  const [tipo, setTipo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState("");
  const [accionError, setAccionError] = useState("");

  const [baja, setBaja] = useState<DecantResumen | null>(null);
  const [bajaMl, setBajaMl] = useState("");
  const [bajaNota, setBajaNota] = useState("");
  const [bajaError, setBajaError] = useState("");
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    getAlmacenes({ pageSize: 200 })
      .then((p) => setAlmacenes(p.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setBuscar(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const cargar = useCallback(() => {
    getDecants({ almacenId: almacenId || undefined, search: buscar || undefined })
      .then(setResumen)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getMovimientosDecant({ almacenId: almacenId || undefined, tipo: tipo || undefined, page: pagina, pageSize: PAGE_SIZE })
      .then(setMovs)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [almacenId, buscar, tipo, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirBaja(fila: DecantResumen) {
    setBaja(fila);
    setBajaMl("");
    setBajaNota("");
    setBajaError("");
  }

  async function confirmarBaja() {
    if (!baja) return;
    const ml = parseInt(bajaMl, 10);
    if (!ml || ml < 1 || ml > baja.mlDisponibles) {
      setBajaError(`Los ml deben estar entre 1 y ${baja.mlDisponibles}.`);
      return;
    }
    setBajando(true);
    setBajaError("");
    try {
      await darBajaMl({ varianteId: baja.varianteId, almacenId: baja.almacenId, cantidadMl: ml, nota: bajaNota.trim() || undefined });
      setBaja(null);
      cargar();
    } catch (e) {
      setBajaError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBajando(false);
    }
  }

  async function deshacer(m: MovimientoDecant) {
    if (!confirm(`¿Deshacer la conversión de ${m.cantidadFrascos} frasco(s)? Los frascos vuelven al stock y se quitan ${m.cantidadMl} ml.`)) return;
    setAccionError("");
    try {
      await deshacerConversionDecant(m.id);
      cargar();
    } catch (e) {
      setAccionError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  const totalPaginas = movs ? Math.max(1, Math.ceil(movs.total / movs.pageSize)) : 1;

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 style={{ margin: "0 0 4px", fontSize: 20 }}>Decants</h1>
      <p className="cell-muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
        Frascos convertidos a ml para vender por presentaciones (2, 5, 10 ml...). Para convertir, ve a Existencias, abre el perfume y usa “Decants”. Si un
        perfume no lo muestra, crea primero su variante Decants (unidad ML) en Productos.
      </p>

      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <div className="filter-field">
          <label className="filter-label">Almacén</label>
          <select className="field" value={almacenId} onChange={(e) => { setAlmacenId(e.target.value); setPagina(1); }}>
            <option value="">Todos</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label className="filter-label">Producto</label>
          <input className="field" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." />
        </div>
      </div>

      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>
        ml actuales {resumen && <span className="cell-muted" style={{ fontWeight: 400 }}>· {resumen.totalMl} ml</span>}
      </h2>
      {!resumen ? (
        <p className="cell-muted">Cargando...</p>
      ) : resumen.items.length === 0 ? (
        <p className="cell-muted">No hay ml en stock.</p>
      ) : (
        <div className="table-scroll">
          <table className="table table-minimal table-compact">
            <thead>
              <tr>
                <th>Marca</th>
                <th style={{ minWidth: 220 }}>Producto / Variante</th>
                <th>Almacén</th>
                <th className="num">ml físicos</th>
                <th className="num">ml reservados</th>
                <th className="num">ml disponibles</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {resumen.items.map((r) => (
                <tr key={`${r.varianteId}-${r.almacenId}`}>
                  <td className="cell-muted">{r.variante.product.brand?.name ?? "—"}</td>
                  <td className="cell-primary">
                    <Producto variante={r.variante} />
                  </td>
                  <td>{r.almacen.nombre}</td>
                  <td className="num">{r.mlFisicos}</td>
                  <td className="num">{r.mlReservados}</td>
                  <td className="num cell-primary">{r.mlDisponibles}</td>
                  <td>
                    {r.mlDisponibles > 0 && (
                      <button type="button" className="action-btn" onClick={() => abrirBaja(r)}>
                        Dar de baja ml
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 8px" }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Historial</h2>
        <select className="field" style={{ width: "auto" }} value={tipo} onChange={(e) => { setTipo(e.target.value); setPagina(1); }}>
          <option value="">Conversiones y bajas</option>
          <option value="CONVERSION">Solo conversiones</option>
          <option value="BAJA">Solo bajas de ml</option>
        </select>
      </div>
      {accionError && <p className="error-text">{accionError}</p>}
      {!movs ? (
        <p className="cell-muted">Cargando...</p>
      ) : movs.items.length === 0 ? (
        <p className="cell-muted">Todavía no hay movimientos.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="table table-minimal table-compact">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Movimiento</th>
                  <th style={{ minWidth: 220 }}>Producto</th>
                  <th>Almacén</th>
                  <th className="num">Frascos</th>
                  <th className="num">ml</th>
                  <th className="num">Costo</th>
                  <th>Nota</th>
                  <th>Usuario</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {movs.items.map((m) => (
                  <tr key={m.id} style={m.revertidoAt ? { opacity: 0.55 } : undefined}>
                    <td className="cell-muted">{formatDateTime(m.fecha)}</td>
                    <td>
                      <span className={m.tipo === "CONVERSION" ? "badge badge-info" : "badge badge-muted"}>
                        {m.tipo === "CONVERSION" ? "Convertido" : "Baja de ml"}
                      </span>
                      {m.revertidoAt && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Deshecho</span>}
                    </td>
                    <td className="cell-primary">
                      <Producto variante={m.varianteOrigen ?? m.variante} />
                    </td>
                    <td>{m.almacen.nombre}</td>
                    <td className="num">{m.tipo === "CONVERSION" ? `${m.cantidadFrascos} × ${m.mlPorFrasco} ml` : "—"}</td>
                    <td className="num">{m.tipo === "CONVERSION" ? `+${m.cantidadMl}` : `−${m.cantidadMl}`}</td>
                    <td className="num">{usd(m.costoTotal)}</td>
                    <td className="cell-muted">{m.nota ?? "—"}</td>
                    <td className="cell-muted">{m.creadoPor.nombre}</td>
                    <td>
                      {m.tipo === "CONVERSION" && !m.revertidoAt && (
                        <button type="button" className="action-btn" onClick={() => deshacer(m)}>
                          Deshacer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPaginas > 1 && (
            <div className="pagination">
              <button type="button" className={`pagination-btn${pagina <= 1 ? " disabled" : ""}`} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                ← Anterior
              </button>
              <span className="pagination-info">
                Página {pagina} de {totalPaginas}
              </span>
              <button type="button" className={`pagination-btn${pagina >= totalPaginas ? " disabled" : ""}`} disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {baja && (
        <Modal title={`Dar de baja ml: ${baja.variante.product.name}`} onClose={() => setBaja(null)} maxWidth={440}>
          <div className="form-grid">
            <p className="cell-muted" style={{ margin: 0, fontSize: 13 }}>
              Para ml que se derramaron, se evaporaron o se perdieron. Baja el stock de ml (con su costo) y queda en el historial.
            </p>
            <div>
              <label>ml a dar de baja (hay {baja.mlDisponibles})</label>
              <input className="field" type="number" min={1} max={baja.mlDisponibles} value={bajaMl} onChange={(e) => setBajaMl(e.target.value)} />
            </div>
            <div>
              <label>Motivo (opcional)</label>
              <input className="field" value={bajaNota} maxLength={300} onChange={(e) => setBajaNota(e.target.value)} placeholder="Ej. se derramó al llenar" />
            </div>
            {bajaError && <p className="error-text">{bajaError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setBaja(null)}>
                Cancelar
              </button>
              <button type="button" className="button" disabled={bajando} onClick={confirmarBaja}>
                {bajando ? "Guardando..." : "Dar de baja"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
