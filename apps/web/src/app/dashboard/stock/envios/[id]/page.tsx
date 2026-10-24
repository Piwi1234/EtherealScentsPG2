"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ApiError,
  agregarCompraAEnvio,
  anularEnvio,
  confirmarRecepcionEnvio,
  getComprasDisponiblesParaEnvio,
  getEnvio,
  getProducts,
  iniciarRecepcionEnvio,
  marcarEnvioEnTransito,
  quitarCompraDeEnvio,
  updateRecepcionLinea,
} from "../../../../../lib/api";
import type { Envio, EnvioRecepcionLinea, EnvioVariante, Product, Proforma } from "../../../../../lib/types";
import { ESTADO_ENVIO_CLASE, ESTADO_ENVIO_LABEL } from "../../../../../lib/envio-estados";
import { EstadoBadge } from "../../../../../components/proformas/EstadoBadge";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function varianteLabel(v: EnvioVariante): string {
  const opciones = v.options.map((o) => o.optionValue.value).join(", ");
  const marca = v.product.brand?.name ? `${v.product.brand.name} · ` : "";
  return `${marca}${v.product.name}${opciones ? ` — ${opciones}` : ""}`;
}

function proveedoresDe(compra: Proforma): string {
  const nombres = Array.from(new Set(compra.detalles.map((d) => d.proveedor?.nombre).filter((n): n is string => Boolean(n))));
  return nombres.length > 0 ? nombres.join(", ") : "Sin proveedor";
}

function totalCompra(compra: Proforma): number {
  return compra.detalles.reduce((sum, d) => sum + Number(d.subtotal), 0);
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

function RecepcionFila({
  envioId,
  linea,
  readOnly,
  onChanged,
  onError,
}: {
  envioId: string;
  linea: EnvioRecepcionLinea;
  readOnly: boolean;
  onChanged: (e: Envio) => void;
  onError: (m: string) => void;
}) {
  const [cambiando, setCambiando] = useState(false);
  const distintaVariante = linea.varianteRecibidaId !== linea.varianteEsperadaId;
  const distintaCantidad = linea.cantidadRecibida !== linea.cantidadEsperada;

  async function patch(data: { cantidadRecibida?: number; varianteRecibidaId?: string; nota?: string }) {
    try {
      onChanged(await updateRecepcionLinea(envioId, linea.id, data));
    } catch (e) {
      onError(e instanceof ApiError ? e.message : String(e));
    }
  }

  if (readOnly) {
    return (
      <tr style={distintaVariante || distintaCantidad ? { background: "rgba(201, 169, 110, 0.08)" } : undefined}>
        <td className="cell-muted">{linea.compraDetalle.proveedor?.nombre ?? "—"}</td>
        <td>{varianteLabel(linea.varianteEsperada)}</td>
        <td className="num">{linea.cantidadEsperada}</td>
        <td>{distintaVariante ? varianteLabel(linea.varianteRecibida) : "Lo esperado"}</td>
        <td className="num cell-primary">{linea.cantidadRecibida}</td>
        <td className="cell-muted">{linea.nota ?? "—"}</td>
      </tr>
    );
  }

  return (
    <tr style={distintaVariante || distintaCantidad ? { background: "rgba(201, 169, 110, 0.08)" } : undefined}>
      <td className="cell-muted">{linea.compraDetalle.proveedor?.nombre ?? "—"}</td>
      <td>{varianteLabel(linea.varianteEsperada)}</td>
      <td className="num">{linea.cantidadEsperada}</td>
      <td style={{ minWidth: 220 }}>
        {cambiando ? (
          <VarianteBuscador
            onCancel={() => setCambiando(false)}
            onPick={(v) => {
              setCambiando(false);
              patch({ varianteRecibidaId: v.id });
            }}
          />
        ) : (
          <div>
            <span>{distintaVariante ? varianteLabel(linea.varianteRecibida) : "Lo esperado"}</span>
            <button type="button" className="link-button" style={{ marginLeft: 8, fontSize: 12 }} onClick={() => setCambiando(true)}>
              Llegó otro
            </button>
            {distintaVariante && (
              <button type="button" className="link-button" style={{ marginLeft: 8, fontSize: 12 }} onClick={() => patch({ varianteRecibidaId: linea.varianteEsperadaId })}>
                Restaurar
              </button>
            )}
          </div>
        )}
      </td>
      <td className="num">
        <input
          key={`${linea.id}-${linea.cantidadRecibida}`}
          className="field"
          type="number"
          min={0}
          step={1}
          defaultValue={linea.cantidadRecibida}
          style={{ width: 80, textAlign: "center" }}
          onBlur={(e) => {
            const n = Math.floor(Number(e.target.value));
            if (Number.isFinite(n) && n >= 0 && n !== linea.cantidadRecibida) patch({ cantidadRecibida: n });
          }}
        />
      </td>
      <td>
        <input
          key={`n-${linea.id}-${linea.nota ?? ""}`}
          className="field"
          placeholder="Nota (opcional)"
          defaultValue={linea.nota ?? ""}
          onBlur={(e) => {
            if (e.target.value !== (linea.nota ?? "")) patch({ nota: e.target.value });
          }}
        />
      </td>
    </tr>
  );
}

export default function EnvioDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [disponibles, setDisponibles] = useState<Proforma[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cargado = useRef(false);

  const load = useCallback(() => {
    getEnvio(id)
      .then((e) => {
        setEnvio(e);
        cargado.current = true;
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (envio?.estado === "ARMANDO") getComprasDisponiblesParaEnvio().then(setDisponibles).catch(() => {});
  }, [envio?.estado, envio?.compras.length]);

  async function run(action: () => Promise<Envio>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    setError("");
    try {
      setEnvio(await action());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!envio) {
    return <div className="card">{error ? <p className="error-text">{error}</p> : <p>Cargando...</p>}</div>;
  }

  const abierto = envio.estado === "ARMANDO" || envio.estado === "EN_TRANSITO";
  const recepcionAbierta = envio.recepcion.length > 0;
  const totalEsperado = envio.recepcion.reduce((s, l) => s + l.cantidadEsperada, 0);
  const totalRecibido = envio.recepcion.reduce((s, l) => s + l.cantidadRecibida, 0);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Envío — {envio.codigo}</h1>
          <span className={`badge ${ESTADO_ENVIO_CLASE[envio.estado]}`}>{ESTADO_ENVIO_LABEL[envio.estado]}</span>
        </div>
        <Link href="/dashboard/stock/envios" className="link-button">
          Volver
        </Link>
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
          <span className="filter-label">Recibido</span>
          <p style={{ margin: "4px 0 0" }}>{formatDate(envio.fechaRecepcion)}</p>
        </div>
        {envio.nota && (
          <div style={{ gridColumn: "1 / -1" }}>
            <span className="filter-label">Nota</span>
            <p style={{ margin: "4px 0 0" }}>{envio.nota}</p>
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Compras del envío</h2>
      {envio.compras.length === 0 ? (
        <p className="cell-muted">Todavía no hay compras en este envío.</p>
      ) : (
        <div className="table-scroll">
          <table className="table table-minimal table-compact">
            <thead>
              <tr>
                <th>Compra</th>
                <th>Estado</th>
                <th>Proveedores</th>
                <th className="num">Líneas</th>
                <th className="num">Total $</th>
                {envio.estado === "ARMANDO" && <th></th>}
              </tr>
            </thead>
            <tbody>
              {envio.compras.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/dashboard/proformas/${c.id}`} className="link-button">
                      {c.codigo}
                    </Link>
                  </td>
                  <td>
                    <EstadoBadge estado={c.estado} />
                  </td>
                  <td className="cell-muted">{proveedoresDe(c)}</td>
                  <td className="num">{c.detalles.length}</td>
                  <td className="num">$ {totalCompra(c).toFixed(2)}</td>
                  {envio.estado === "ARMANDO" && (
                    <td className="num">
                      <button type="button" className="action-btn danger" disabled={busy} onClick={() => run(() => quitarCompraDeEnvio(id, c.id))}>
                        Quitar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {envio.estado === "ARMANDO" && disponibles.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <span className="filter-label">Sumar una compra aprobada</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {disponibles.map((c) => (
              <button key={c.id} type="button" className="action-btn" disabled={busy} onClick={() => run(() => agregarCompraAEnvio(id, c.id))}>
                + {c.codigo} · {proveedoresDe(c)}
              </button>
            ))}
          </div>
        </div>
      )}

      {recepcionAbierta && (
        <>
          <h2 style={{ fontSize: 16, margin: "28px 0 4px" }}>Recepción</h2>
          <p className="cell-muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
            {abierto
              ? "Corregí lo que realmente llegó: la cantidad (0 si no llegó) o el producto, si llegó otro distinto. Al confirmar se crean los lotes y el stock con estas cantidades y las compras del envío quedan completadas."
              : "Lo que se recibió en este envío. Las filas resaltadas tuvieron diferencias respecto de lo esperado."}
          </p>
          <div className="table-scroll">
            <table className="table table-minimal table-compact">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th style={{ minWidth: 220 }}>Esperado</th>
                  <th className="num">Cant.</th>
                  <th>Llegó</th>
                  <th className="num">Cant. recibida</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {envio.recepcion.map((l) => (
                  <RecepcionFila key={l.id} envioId={id} linea={l} readOnly={!abierto} onChanged={setEnvio} onError={setError} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="cell-muted" style={{ textAlign: "right", fontWeight: 600 }}>
                    Total unidades
                  </td>
                  <td className="num cell-primary">{totalEsperado}</td>
                  <td></td>
                  <td className="num cell-primary">{totalRecibido}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)", display: "flex", gap: 10, flexWrap: "wrap" }}>
        {envio.estado === "ARMANDO" && (
          <button type="button" className="action-btn" disabled={busy || envio.compras.length === 0} onClick={() => run(() => marcarEnvioEnTransito(id))}>
            Marcar en tránsito
          </button>
        )}
        {abierto && !recepcionAbierta && (
          <button type="button" className="action-btn" disabled={busy || envio.compras.length === 0} onClick={() => run(() => iniciarRecepcionEnvio(id))}>
            Recibir envío
          </button>
        )}
        {abierto && recepcionAbierta && (
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() =>
              run(
                () => confirmarRecepcionEnvio(id),
                `¿Confirmar la recepción? Se van a cargar ${totalRecibido} unidades al stock de ${envio.almacenDestino.nombre} y las compras quedarán completadas.`,
              )
            }
          >
            {busy ? "Confirmando..." : "Confirmar recepción"}
          </button>
        )}
        {abierto && (
          <button
            type="button"
            className="action-btn danger"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const e = await anularEnvio(id);
                router.refresh();
                return e;
              }, "¿Anular el envío? Las compras vuelven a quedar libres para otro envío.")
            }
          >
            Anular envío
          </button>
        )}
      </div>
    </div>
  );
}
