"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ApiError,
  agregarItemEnvio,
  anularEnvio,
  cerrarEnvio,
  downloadEnvioPdf,
  getEnvio,
  getEnviosDisponibles,
  getProducts,
  marcarEnvioEnTransito,
  quitarItemEnvio,
  recibirEnvio,
  updateItemEnvio,
  updateNotaPieEnvio,
} from "../../../../../lib/api";
import type { Envio, EnvioDisponible, EnvioItem, EnvioVariante, Product } from "../../../../../lib/types";
import { ESTADO_ENVIO_CLASE, ESTADO_ENVIO_LABEL } from "../../../../../lib/envio-estados";
import { Modal } from "../../../../../components/Modal";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function varianteLabel(v: EnvioVariante): string {
  const opciones = v.options.map((o) => o.optionValue.value).join(", ");
  const marca = v.product.brand?.name ? `${v.product.brand.name} · ` : "";
  return `${marca}${v.product.name}${opciones ? ` — ${opciones}` : ""}`;
}

/** Buscador mínimo de variantes para el caso "llegó otro producto distinto al esperado". */
function VarianteBuscador({ onPick, onCancel }: { onPick: (variante: { id: string; label: string }) => void; onCancel: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      setLoading(true);
      getProducts({ search: query.trim(), pageSize: 10 })
        .then((page) => setResults(page.items))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 260 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input className="field" autoFocus placeholder="Buscar producto recibido…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="link-button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      {loading && <span className="cell-muted">Buscando...</span>}
      {results.flatMap((p) =>
        p.variants.map((v) => {
          const opciones = v.options.map((o) => o.optionValue.value).join(", ");
          const label = `${p.brand?.name ? `${p.brand.name} · ` : ""}${p.name}${opciones ? ` — ${opciones}` : ""}`;
          return (
            <button key={v.id} type="button" className="autocomplete-option" onClick={() => onPick({ id: v.id, label })}>
              {label}
            </button>
          );
        }),
      )}
    </div>
  );
}

function CantidadEditable({ item, disabled, onCommit }: { item: EnvioItem; disabled: boolean; onCommit: (cantidad: number) => void }) {
  const [valor, setValor] = useState(String(item.cantidad));
  return (
    <input
      className="field"
      type="number"
      min={1}
      value={valor}
      disabled={disabled}
      aria-label={`Cantidad de ${item.compraDetalle.variante.product.name}`}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => {
        const n = parseInt(valor, 10);
        if (!n || n < 1) setValor(String(item.cantidad));
        else if (n !== item.cantidad) onCommit(n);
      }}
      style={{ width: 80, textAlign: "center" }}
    />
  );
}

type LineaRecepcion = {
  cantidad: number;
  variante?: { id: string; label: string };
  buscando?: boolean;
  /** Costos reales por unidad (texto del input); sin valor, el estimado de la compra. */
  envio?: string;
  seguridad?: string;
  logistica?: string;
};

function num(valor: string | null | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Costo real por unidad: el precio de compra (fijo) más los costos que se corrigen al recibir. */
function costoUnitario(item: EnvioItem, l: LineaRecepcion): number {
  const d = item.compraDetalle;
  return num(d.precioCompra) + (l.envio !== undefined ? num(l.envio) : num(d.costoEnvio)) + (l.seguridad !== undefined ? num(l.seguridad) : num(d.costoSeguridad)) + (l.logistica !== undefined ? num(l.logistica) : num(d.costoLogistica));
}

export default function EnvioDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [disponibles, setDisponibles] = useState<EnvioDisponible[]>([]);
  const [aSumar, setASumar] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [notaPie, setNotaPie] = useState("");
  const [notaPieOriginal, setNotaPieOriginal] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [descargando, setDescargando] = useState(false);

  const [recibiendo, setRecibiendo] = useState(false);
  const [lineas, setLineas] = useState<Record<string, LineaRecepcion>>({});
  const [notaRecepcion, setNotaRecepcion] = useState("");
  const [recError, setRecError] = useState("");

  const load = useCallback(() => {
    getEnvio(id)
      .then((e) => {
        setEnvio(e);
        setNotaPie(e.notaPie ?? "");
        setNotaPieOriginal(e.notaPie ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  useEffect(load, [load]);

  const armando = envio?.estado === "ARMANDO";
  useEffect(() => {
    if (armando) getEnviosDisponibles().then(setDisponibles).catch(() => {});
  }, [armando, envio?.items.length]);

  async function run(action: () => Promise<Envio>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    setError("");
    try {
      setEnvio(await action());
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!envio) {
    return <div className="card">{error ? <p className="error-text">{error}</p> : <p>Cargando...</p>}</div>;
  }

  const enCamino = envio.estado === "EN_TRANSITO";
  const total = envio.items.reduce((n, i) => n + i.cantidad, 0);
  const recibidas = envio.items.reduce((n, i) => n + i.cantidadRecibida, 0);
  const faltan = total - recibidas;
  const pendientes = envio.items.filter((i) => i.cantidad > i.cantidadRecibida);
  const hayRecepciones = envio.recepciones.length > 0;

  async function guardarNotaPie() {
    if (notaPie.trim() === notaPieOriginal.trim()) return;
    setGuardandoNota(true);
    setError("");
    try {
      const actualizado = await updateNotaPieEnvio(id, notaPie.trim());
      setNotaPieOriginal(actualizado.notaPie ?? "");
      setNotaPie(actualizado.notaPie ?? "");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setGuardandoNota(false);
    }
  }

  async function descargarPdf() {
    setDescargando(true);
    setError("");
    try {
      await guardarNotaPie();
      await downloadEnvioPdf(id, envio!.codigo);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setDescargando(false);
    }
  }

  function abrirRecepcion() {
    setLineas({});
    setNotaRecepcion("");
    setRecError("");
    setRecibiendo(true);
  }

  async function handleRecibir(e: React.FormEvent) {
    e.preventDefault();
    const items = Object.entries(lineas)
      .filter(([, l]) => l.cantidad > 0)
      .map(([envioItemId, l]) => ({
        envioItemId,
        cantidad: l.cantidad,
        varianteRecibidaId: l.variante?.id,
        costoEnvio: l.envio !== undefined && l.envio !== "" ? num(l.envio) : undefined,
        costoSeguridad: l.seguridad !== undefined && l.seguridad !== "" ? num(l.seguridad) : undefined,
        costoLogistica: l.logistica !== undefined && l.logistica !== "" ? num(l.logistica) : undefined,
      }));
    if (items.length === 0) {
      setRecError("Ingresá cuántas unidades llegaron de al menos un producto.");
      return;
    }
    setBusy(true);
    setRecError("");
    try {
      setEnvio(await recibirEnvio(id, { nota: notaRecepcion.trim() || undefined, items }));
      setRecibiendo(false);
      router.refresh();
    } catch (err) {
      setRecError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Envío — {envio.codigo}</h1>
          <span className={`badge ${ESTADO_ENVIO_CLASE[envio.estado]}`}>{ESTADO_ENVIO_LABEL[envio.estado]}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button type="button" className="action-btn" onClick={descargarPdf} disabled={descargando}>
            {descargando ? "Generando..." : "Descargar PDF"}
          </button>
          <Link href="/dashboard/stock/envios" className="link-button">
            Volver
          </Link>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20, rowGap: 14 }}>
        <div>
          <span className="filter-label">Almacén destino</span>
          <p style={{ margin: "4px 0 0" }}>{envio.almacenDestino.nombre}</p>
        </div>
        <div>
          <span className="filter-label">Creado por</span>
          <p style={{ margin: "4px 0 0" }}>{envio.creadoPor.nombre}</p>
        </div>
        <div>
          <span className="filter-label">Salió</span>
          <p style={{ margin: "4px 0 0" }}>{formatDate(envio.fechaEnvio)}</p>
        </div>
        <div>
          <span className="filter-label">Total de unidades</span>
          <p style={{ margin: "4px 0 0" }}>{total}</p>
        </div>
        <div>
          <span className="filter-label">{envio.estado === "RECIBIDO" ? "Recibido" : "Avance"}</span>
          <p style={{ margin: "4px 0 0" }}>
            {envio.estado === "RECIBIDO" ? formatDate(envio.fechaRecepcion) : `${recibidas} de ${total} unidades llegaron`}
          </p>
        </div>
        {envio.nota && (
          <div style={{ gridColumn: "1 / -1" }}>
            <span className="filter-label">Nota</span>
            <p style={{ margin: "4px 0 0" }}>{envio.nota}</p>
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Productos del envío</h2>
      {envio.items.length === 0 ? (
        <p className="cell-muted">Todavía no hay productos en este envío.</p>
      ) : (
        <div className="table-scroll">
          <table className="table table-minimal table-compact">
            <thead>
              <tr>
                <th>Compra</th>
                <th>Proveedor</th>
                <th style={{ minWidth: 220 }}>Producto</th>
                <th className="num">Cant.</th>
                {!armando && <th className="num">Llegaron</th>}
                {!armando && <th className="num">Faltan</th>}
                {armando && <th></th>}
              </tr>
            </thead>
            <tbody>
              {envio.items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/dashboard/proformas/${i.compraDetalle.proforma.id}`} className="link-button">
                      {i.compraDetalle.proforma.codigo}
                    </Link>
                  </td>
                  <td className="cell-muted">{i.compraDetalle.proveedor?.nombre ?? "—"}</td>
                  <td className="cell-primary">{varianteLabel(i.compraDetalle.variante)}</td>
                  <td className="num">
                    {armando ? (
                      <CantidadEditable key={`${i.id}-${i.cantidad}`} item={i} disabled={busy} onCommit={(c) => run(() => updateItemEnvio(id, i.id, { cantidad: c }))} />
                    ) : (
                      i.cantidad
                    )}
                  </td>
                  {!armando && <td className="num">{i.cantidadRecibida}</td>}
                  {!armando && (
                    <td className="num">{i.cantidad - i.cantidadRecibida > 0 ? <span className="badge badge-warn">{i.cantidad - i.cantidadRecibida}</span> : <span className="cell-muted">—</span>}</td>
                  )}
                  {armando && (
                    <td className="num">
                      <button type="button" className="action-btn danger" disabled={busy} onClick={() => run(() => quitarItemEnvio(id, i.id))}>
                        Quitar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="cell-muted" style={{ textAlign: "right", fontWeight: 600 }}>
                  Total de unidades
                </td>
                <td className="num cell-primary">{total}</td>
                {!armando && <td className="num cell-primary">{recibidas}</td>}
                {!armando && <td className="num cell-primary">{faltan > 0 ? faltan : "—"}</td>}
                {armando && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <label className="filter-label" htmlFor="envio-nota-pie">
          Nota al pie (se imprime en el pie del PDF)
        </label>
        <textarea
          id="envio-nota-pie"
          className="field"
          rows={2}
          maxLength={600}
          value={notaPie}
          placeholder="Ej. Mercadería frágil: revisar al recibir."
          onChange={(e) => setNotaPie(e.target.value)}
          onBlur={guardarNotaPie}
          style={{ width: "100%", marginTop: 6, resize: "vertical" }}
        />
        <p className="cell-muted" style={{ fontSize: 11.5, margin: "4px 0 0" }}>
          {guardandoNota ? "Guardando..." : "Se guarda al salir del campo. Se puede editar en cualquier estado del envío."}
        </p>
      </div>

      {armando && disponibles.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <span className="filter-label">Sumar productos recogidos</span>
          <div className="table-scroll" style={{ marginTop: 6 }}>
            <table className="table table-minimal table-compact">
              <thead>
                <tr>
                  <th>Compra</th>
                  <th style={{ minWidth: 220 }}>Producto</th>
                  <th className="num">Recogidas sin enviar</th>
                  <th className="num">Sumar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {disponibles.map((l) => {
                  const c = aSumar[l.id] ?? l.disponible;
                  return (
                    <tr key={l.id}>
                      <td>{l.proforma.codigo}</td>
                      <td className="cell-primary">{varianteLabel(l.variante)}</td>
                      <td className="num">{l.disponible}</td>
                      <td className="num">
                        <input
                          className="field"
                          type="number"
                          min={1}
                          max={l.disponible}
                          value={c}
                          aria-label={`Unidades de ${l.variante.product.name} a sumar`}
                          onChange={(e) => setASumar((prev) => ({ ...prev, [l.id]: Math.max(1, Math.min(l.disponible, parseInt(e.target.value, 10) || 1)) }))}
                          style={{ width: 80, textAlign: "center" }}
                        />
                      </td>
                      <td className="num">
                        <button type="button" className="action-btn" disabled={busy} onClick={() => run(() => agregarItemEnvio(id, { compraDetalleId: l.id, cantidad: c }))}>
                          + Sumar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hayRecepciones && (
        <>
          <h2 style={{ fontSize: 16, margin: "28px 0 10px" }}>Recepciones</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {envio.recepciones.map((r) => (
              <div key={r.id} style={{ padding: "8px 14px", border: "1px solid var(--color-divider)", borderRadius: 10 }}>
                <strong style={{ fontSize: 13 }}>{formatDate(r.fecha)}</strong>
                <span className="cell-muted" style={{ fontSize: 12.5 }}>
                  {" "}
                  · {r.creadoPor.nombre}
                  {r.nota ? ` · ${r.nota}` : ""}
                </span>
                <div className="cell-muted" style={{ fontSize: 12.5 }}>
                  {r.items
                    .map((it) => {
                      const esperado = envio.items.find((x) => x.id === it.envioItem.id)?.compraDetalle.variante;
                      const otro = esperado && esperado.id !== it.varianteRecibidaId;
                      const costos = it.costoEnvio !== null ? ` · costos $ ${(num(it.costoEnvio) + num(it.costoSeguridad) + num(it.costoLogistica)).toFixed(2)}/u` : "";
                      return `${varianteLabel(it.varianteRecibida)} × ${it.cantidad}${otro ? ` (esperado: ${esperado.product.name})` : ""}${costos}`;
                    })
                    .join(" · ")}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)", display: "flex", gap: 10, flexWrap: "wrap" }}>
        {armando && (
          <button type="button" className="button" disabled={busy || envio.items.length === 0} onClick={() => run(() => marcarEnvioEnTransito(id))}>
            Marcar como enviado
          </button>
        )}
        {enCamino && faltan > 0 && (
          <button type="button" className="button" disabled={busy} onClick={abrirRecepcion}>
            Registrar recepción
          </button>
        )}
        {enCamino && hayRecepciones && faltan > 0 && (
          <button
            type="button"
            className="action-btn"
            disabled={busy}
            onClick={() =>
              run(() => cerrarEnvio(id), `¿Cerrar el envío dando por no llegadas ${faltan} unidades? Vuelven a quedar recogidas sin enviar, para armar otro envío.`)
            }
          >
            Cerrar con lo recibido
          </button>
        )}
        {(armando || (enCamino && !hayRecepciones)) && (
          <button
            type="button"
            className="action-btn danger"
            disabled={busy}
            onClick={() => run(() => anularEnvio(id), "¿Anular el envío? Sus productos vuelven a quedar recogidos sin enviar.")}
          >
            Anular envío
          </button>
        )}
      </div>

      {recibiendo && (
        <Modal title="Registrar recepción" onClose={() => setRecibiendo(false)} maxWidth={1080}>
          <form className="form-grid" onSubmit={handleRecibir}>
            <p className="cell-muted" style={{ margin: 0, fontSize: 13 }}>
              Indicá cuántas unidades llegaron de cada producto. Lo que no llegue sigue en camino. Si llegó un producto distinto al esperado, usá
              «Llegó otro».
            </p>
            <div className="table-scroll">
              <table className="table table-minimal table-compact">
                <thead>
                  <tr>
                    <th style={{ minWidth: 200 }}>Esperado</th>
                    <th className="num">Faltan</th>
                    <th className="num">Llegaron</th>
                    <th>Llegó</th>
                    <th className="num">Envío $</th>
                    <th className="num">Seguridad $</th>
                    <th className="num">Logística $</th>
                    <th className="num">Costo real $</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((i) => {
                    const falta = i.cantidad - i.cantidadRecibida;
                    const l = lineas[i.id] ?? { cantidad: 0 };
                    return (
                      <tr key={i.id}>
                        <td className="cell-primary">
                          {varianteLabel(i.compraDetalle.variante)}
                          <div className="cell-muted" style={{ fontSize: 12, fontWeight: 400 }}>{i.compraDetalle.proforma.codigo}</div>
                        </td>
                        <td className="num">{falta}</td>
                        <td className="num">
                          <input
                            className="field"
                            type="number"
                            min={0}
                            max={falta}
                            value={l.cantidad}
                            aria-label={`Unidades que llegaron de ${i.compraDetalle.variante.product.name}`}
                            onChange={(e) => setLineas((prev) => ({ ...prev, [i.id]: { ...l, cantidad: Math.max(0, Math.min(falta, parseInt(e.target.value, 10) || 0)) } }))}
                            style={{ width: 80, textAlign: "center" }}
                          />
                        </td>
                        <td style={{ minWidth: 220 }}>
                          {l.buscando ? (
                            <VarianteBuscador
                              onCancel={() => setLineas((prev) => ({ ...prev, [i.id]: { ...l, buscando: false } }))}
                              onPick={(v) => setLineas((prev) => ({ ...prev, [i.id]: { ...l, variante: v, buscando: false } }))}
                            />
                          ) : (
                            <div>
                              <span>{l.variante ? l.variante.label : "Lo esperado"}</span>
                              <button type="button" className="link-button" style={{ marginLeft: 8, fontSize: 12 }} onClick={() => setLineas((prev) => ({ ...prev, [i.id]: { ...l, buscando: true } }))}>
                                Llegó otro
                              </button>
                              {l.variante && (
                                <button type="button" className="link-button" style={{ marginLeft: 8, fontSize: 12 }} onClick={() => setLineas((prev) => ({ ...prev, [i.id]: { ...l, variante: undefined } }))}>
                                  Restaurar
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        {(["envio", "seguridad", "logistica"] as const).map((campo) => {
                          const estimado = campo === "envio" ? i.compraDetalle.costoEnvio : campo === "seguridad" ? i.compraDetalle.costoSeguridad : i.compraDetalle.costoLogistica;
                          return (
                            <td className="num" key={campo}>
                              <input
                                className="field"
                                type="number"
                                min={0}
                                step="0.01"
                                value={l[campo] ?? String(num(estimado))}
                                aria-label={`Costo de ${campo} por unidad de ${i.compraDetalle.variante.product.name}`}
                                onChange={(e) => setLineas((prev) => ({ ...prev, [i.id]: { ...l, [campo]: e.target.value } }))}
                                style={{ width: 76, textAlign: "center" }}
                              />
                            </td>
                          );
                        })}
                        <td className="num cell-primary">
                          {costoUnitario(i, l).toFixed(2)}
                          <div className="cell-muted" style={{ fontSize: 11, fontWeight: 400 }}>compra {num(i.compraDetalle.precioCompra).toFixed(2)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="cell-muted" style={{ margin: 0, fontSize: 12.5 }}>
              Los costos de envío, seguridad y logística vienen con lo estimado en la compra: corrígelos con lo que realmente costó, por unidad. El precio de compra no se modifica. El costo real queda en el lote y es el que usa el margen de las ventas.
            </p>
            <div>
              <button
                type="button"
                className="link-button"
                onClick={() => setLineas(Object.fromEntries(pendientes.map((i) => [i.id, { ...(lineas[i.id] ?? {}), cantidad: i.cantidad - i.cantidadRecibida }])))}
              >
                Llegó todo lo que falta
              </button>
            </div>
            <div>
              <label>Nota (opcional)</label>
              <input className="field" value={notaRecepcion} maxLength={300} onChange={(e) => setNotaRecepcion(e.target.value)} placeholder="Ej. llegó la primera caja" />
            </div>
            {recError && <p className="error-text">{recError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setRecibiendo(false)}>
                Cancelar
              </button>
              <button type="submit" className="button" disabled={busy}>
                {busy ? "Guardando..." : "Registrar recepción"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
