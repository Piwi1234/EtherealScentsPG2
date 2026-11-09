"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, darBajaProbador, getAlmacenes, getDecantDestinos, getMovimientosProbador, getProbadores, probadorADecant } from "../../../../lib/api";
import type { Almacen, MovimientoProbador, Page, ProbadorResumen, ProbadorVariante } from "../../../../lib/types";
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
 * Control interno de probadores: lo que hay ahora (convertidos del stock menos dados de baja) y el historial de
 * conversiones y bajas. Las conversiones se hacen desde Existencias (botón "Probador").
 */
export default function ProbadoresPage() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacenId, setAlmacenId] = useState("");
  const [search, setSearch] = useState("");
  const [buscar, setBuscar] = useState("");
  const [incluirAgotados, setIncluirAgotados] = useState(false);
  const [resumen, setResumen] = useState<{ items: ProbadorResumen[]; totalPiezas: number } | null>(null);
  const [movs, setMovs] = useState<Page<MovimientoProbador> | null>(null);
  const [tipo, setTipo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState("");

  const [baja, setBaja] = useState<ProbadorResumen | null>(null);
  const [bajaCantidad, setBajaCantidad] = useState("1");
  const [bajaNota, setBajaNota] = useState("");
  const [bajaError, setBajaError] = useState("");
  const [bajando, setBajando] = useState(false);

  // Pasar probadores a decant (ml).
  const [decant, setDecant] = useState<ProbadorResumen | null>(null);
  const [decantDestinos, setDecantDestinos] = useState<ProbadorVariante[] | null>(null);
  const [decantDestinoId, setDecantDestinoId] = useState("");
  const [decantCantidad, setDecantCantidad] = useState("1");
  const [decantMlFrasco, setDecantMlFrasco] = useState("");
  const [decantMl, setDecantMl] = useState("");
  const [decantNota, setDecantNota] = useState("");
  const [decantError, setDecantError] = useState("");
  const [vertiendo, setVertiendo] = useState(false);

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
    getProbadores({ almacenId: almacenId || undefined, search: buscar || undefined, incluirAgotados })
      .then(setResumen)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getMovimientosProbador({ almacenId: almacenId || undefined, tipo: tipo || undefined, page: pagina, pageSize: PAGE_SIZE })
      .then(setMovs)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [almacenId, buscar, incluirAgotados, tipo, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirBaja(fila: ProbadorResumen) {
    setBaja(fila);
    setBajaCantidad("1");
    setBajaNota("");
    setBajaError("");
  }

  async function confirmarBaja() {
    if (!baja) return;
    const cantidad = parseInt(bajaCantidad, 10);
    if (!cantidad || cantidad < 1 || cantidad > baja.saldo) {
      setBajaError(`La cantidad debe estar entre 1 y ${baja.saldo}.`);
      return;
    }
    setBajando(true);
    setBajaError("");
    try {
      await darBajaProbador({ varianteId: baja.varianteId, almacenId: baja.almacenId, cantidad, nota: bajaNota.trim() || undefined });
      setBaja(null);
      cargar();
    } catch (e) {
      setBajaError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBajando(false);
    }
  }

  function abrirDecant(fila: ProbadorResumen) {
    setDecant(fila);
    setDecantDestinos(null);
    setDecantDestinoId("");
    setDecantCantidad("1");
    setDecantMlFrasco("");
    setDecantMl("");
    setDecantNota("");
    setDecantError("");
    getDecantDestinos(fila.varianteId)
      .then((d) => {
        setDecantDestinos(d);
        if (d.length === 1) setDecantDestinoId(d[0].id);
      })
      .catch((e) => setDecantError(e instanceof Error ? e.message : String(e)));
  }

  async function confirmarDecant() {
    if (!decant) return;
    const cantidad = parseInt(decantCantidad, 10);
    const mlFrasco = parseInt(decantMlFrasco, 10);
    const ml = parseInt(decantMl, 10);
    if (!decantDestinoId) return setDecantError("Elige la variante Decants que recibe los ml.");
    if (!cantidad || cantidad < 1 || cantidad > decant.saldo) return setDecantError(`La cantidad de probadores debe estar entre 1 y ${decant.saldo}.`);
    if (!mlFrasco || mlFrasco < 1) return setDecantError("Indica los ml de fábrica del frasco.");
    if (!ml || ml < 1) return setDecantError("Indica cuántos ml rescatas.");
    if (ml > cantidad * mlFrasco) return setDecantError(`No pueden ser más de ${cantidad * mlFrasco} ml (${cantidad} × ${mlFrasco} ml).`);
    setVertiendo(true);
    setDecantError("");
    try {
      await probadorADecant({
        varianteOrigenId: decant.varianteId,
        varianteId: decantDestinoId,
        almacenId: decant.almacenId,
        cantidadProbadores: cantidad,
        mlPorFrasco: mlFrasco,
        mlRescatados: ml,
        nota: decantNota.trim() || undefined,
      });
      setDecant(null);
      cargar();
    } catch (e) {
      setDecantError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setVertiendo(false);
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
      <h1 style={{ margin: "0 0 4px", fontSize: 20 }}>Probadores</h1>
      <p className="cell-muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
        Piezas sacadas del stock para probar: no se venden ni generan ganancia. Para convertir stock en probador, ve a Existencias, abre el producto y usa
        “Probador”.
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
          <label className="filter-label">Producto o marca</label>
          <input className="field" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, alignSelf: "flex-end", paddingBottom: 8 }}>
          <input type="checkbox" checked={incluirAgotados} onChange={(e) => setIncluirAgotados(e.target.checked)} />
          Incluir los que ya no quedan
        </label>
      </div>

      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>
        Probadores actuales {resumen && <span className="cell-muted" style={{ fontWeight: 400 }}>· {resumen.totalPiezas} pieza(s)</span>}
      </h2>
      {!resumen ? (
        <p className="cell-muted">Cargando...</p>
      ) : resumen.items.length === 0 ? (
        <p className="cell-muted">No hay probadores registrados.</p>
      ) : (
        <div className="table-scroll">
          <table className="table table-minimal table-compact">
            <thead>
              <tr>
                <th>Marca</th>
                <th style={{ minWidth: 220 }}>Producto / Variante</th>
                <th>Almacén</th>
                <th className="num">Convertidos</th>
                <th className="num">Bajas</th>
                <th className="num">Actuales</th>
                <th className="num">Costo convertido</th>
                <th>Último movimiento</th>
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
                  <td className="num">{r.convertidos}</td>
                  <td className="num">{r.bajas}</td>
                  <td className="num cell-primary">{r.saldo}</td>
                  <td className="num">{usd(r.costoConvertido)}</td>
                  <td className="cell-muted">{r.ultimoMovimiento ? formatDateTime(r.ultimoMovimiento) : "—"}</td>
                  <td>
                    {r.saldo > 0 && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="action-btn" onClick={() => abrirDecant(r)}>
                          Pasar a decant
                        </button>
                        <button type="button" className="action-btn" onClick={() => abrirBaja(r)}>
                          Dar de baja
                        </button>
                      </div>
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
          <option value="A_DECANT">Solo pasados a decant</option>
          <option value="BAJA">Solo bajas</option>
        </select>
      </div>
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
                  <th>Marca</th>
                  <th style={{ minWidth: 220 }}>Producto / Variante</th>
                  <th>Almacén</th>
                  <th className="num">Cantidad</th>
                  <th className="num">Costo</th>
                  <th>Nota</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movs.items.map((m) => (
                  <tr key={m.id}>
                    <td className="cell-muted">{formatDateTime(m.fecha)}</td>
                    <td>
                      <span className={m.tipo === "BAJA" ? "badge badge-muted" : "badge badge-info"}>
                        {m.tipo === "CONVERSION" ? "Convertido" : m.tipo === "A_DECANT" ? "A decant" : "Baja"}
                      </span>
                      {m.revertidoAt && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Deshecho</span>}
                    </td>
                    <td className="cell-muted">{m.variante.product.brand?.name ?? "—"}</td>
                    <td className="cell-primary">
                      <Producto variante={m.variante} />
                    </td>
                    <td>{m.almacen.nombre}</td>
                    <td className="num">{m.cantidad}</td>
                    <td className="num">{m.tipo === "BAJA" ? "—" : usd(m.costoTotal)}</td>
                    <td className="cell-muted">{m.nota ?? "—"}</td>
                    <td className="cell-muted">{m.creadoPor.nombre}</td>
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

      {decant && (
        <Modal title={`Pasar a decant: ${decant.variante.product.name}`} onClose={() => setDecant(null)} maxWidth={480}>
          <div className="form-grid">
            <p className="cell-muted" style={{ margin: 0, fontSize: 13 }}>
              Vierte lo que queda de los probadores en los decants (ml) del mismo producto. Los ml entran al stock de decants con el costo por ml del frasco; los
              probadores salen del conteo.
            </p>
            <div>
              <label>Variante Decants que recibe los ml</label>
              {decantDestinos === null ? (
                <p className="cell-muted" style={{ margin: 0 }}>Cargando...</p>
              ) : decantDestinos.length === 0 ? (
                <p className="error-text" style={{ margin: 0 }}>Este producto no tiene una variante en ml (Decants). Créala en la ficha del producto.</p>
              ) : (
                <select className="field" value={decantDestinoId} onChange={(e) => setDecantDestinoId(e.target.value)}>
                  <option value="">Elige...</option>
                  {decantDestinos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {atributosLabel(d) ?? d.variantCode}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label>Probadores que se vierten (hay {decant.saldo})</label>
              <input className="field" type="number" min={1} max={decant.saldo} value={decantCantidad} onChange={(e) => setDecantCantidad(e.target.value)} />
            </div>
            <div>
              <label>ml de fábrica de cada frasco</label>
              <input className="field" type="number" min={1} value={decantMlFrasco} onChange={(e) => setDecantMlFrasco(e.target.value)} placeholder="Ej. 100" />
            </div>
            <div>
              <label>ml que rescatas en total</label>
              <input className="field" type="number" min={1} value={decantMl} onChange={(e) => setDecantMl(e.target.value)} placeholder="Ej. 35" />
            </div>
            <div>
              <label>Nota (opcional)</label>
              <input className="field" value={decantNota} maxLength={300} onChange={(e) => setDecantNota(e.target.value)} />
            </div>
            {decantError && <p className="error-text">{decantError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setDecant(null)}>
                Cancelar
              </button>
              <button type="button" className="button" disabled={vertiendo || decantDestinos?.length === 0} onClick={confirmarDecant}>
                {vertiendo ? "Guardando..." : "Pasar a decant"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {baja && (
        <Modal title={`Dar de baja: ${baja.variante.product.name}`} onClose={() => setBaja(null)} maxWidth={440}>
          <div className="form-grid">
            <p className="cell-muted" style={{ margin: 0, fontSize: 13 }}>
              Para probadores que se agotaron, se perdieron o se dañaron. Baja el conteo de probadores; el stock no se modifica.
            </p>
            <div>
              <label>Cantidad (hay {baja.saldo})</label>
              <input className="field" type="number" min={1} max={baja.saldo} value={bajaCantidad} onChange={(e) => setBajaCantidad(e.target.value)} />
            </div>
            <div>
              <label>Motivo (opcional)</label>
              <input className="field" value={bajaNota} maxLength={300} onChange={(e) => setBajaNota(e.target.value)} placeholder="Ej. se agotó el perfume" />
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
