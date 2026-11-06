"use client";

import Link from "next/link";
import type { StockDetalle, StockRow } from "../../lib/types";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function bs(value: number | null): string {
  return value === null ? "—" : `Bs ${value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function Seccion({ titulo, nota, accion, children }: { titulo: string; nota?: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="exp-sec">
      <div className="exp-sec-head">
        <h3>{titulo}</h3>
        {accion}
      </div>
      {nota && <p className="exp-sec-nota">{nota}</p>}
      {children}
    </section>
  );
}

const ICONO = {
  mas: <path d="M12 5v14M5 12h14" />,
  mover: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  probador: <path d="M9 3h6v4l3 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2l3-12z" />,
  gota: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  siguiente: <path d="m9 6 6 6-6 6" />,
};

function Icono({ d, size = 18 }: { d: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

/** Paso del recorrido de una compra (comprado → recogido → enviado → llegó): completo, a medias o pendiente según lo cumplido. */
function Paso({ etiqueta, valor, total }: { etiqueta: string; valor: number; total: number }) {
  const estado = total > 0 && valor >= total ? "listo" : valor > 0 ? "parcial" : "pendiente";
  return (
    <span className={`exp-paso exp-paso--${estado}`}>
      <i />
      {etiqueta}
      <small>
        {valor} de {total}
      </small>
    </span>
  );
}

/**
 * Detalle de un producto de Existencias: cómo está su stock (en camino → en almacén → reservado → disponible), dónde está, quién
 * lo tiene apartado, qué ventas lo esperan, qué compras vienen en camino, qué solicitudes lo piden y de qué lotes salió.
 */
export function ExistenciaPanel({
  titulo,
  marca,
  categoria,
  atributos,
  imagen,
  detalle,
  cargando,
  onClose,
  onTrasladar,
  onProbador,
  onDecants,
  onSolicitar,
  onVerLotes,
}: {
  titulo: string;
  marca: string | null;
  categoria: string | null;
  atributos: string | null;
  imagen: string | null;
  detalle: StockDetalle | null;
  cargando: boolean;
  onClose: () => void;
  onTrasladar: (row: StockRow) => void;
  onProbador: (row: StockRow) => void;
  /** Solo si el producto tiene variante Decants (ML): convierte frascos de esta fila en ml. */
  onDecants?: (row: StockRow) => void;
  onSolicitar: () => void;
  onVerLotes: () => void;
}) {
  // Almacenes con algo (físico, reservado o en camino) y, de ellos, el que más disponible tiene: sobre ese actúan los botones de arriba.
  const almacenes = detalle?.almacenes.filter((a) => a.cantidadFisica > 0 || a.cantidadReservada > 0 || (a.transitoTotal ?? a.cantidadEnTransito) > 0) ?? [];
  const conDisponible = almacenes.filter((a) => a.cantidadFisica - a.cantidadReservada > 0).sort((a, b) => b.cantidadFisica - b.cantidadReservada - (a.cantidadFisica - a.cantidadReservada));
  const principal = conDisponible[0] ?? null;

  const fisica = almacenes.reduce((n, a) => n + a.cantidadFisica, 0);
  const reservada = almacenes.reduce((n, a) => n + a.cantidadReservada, 0);
  const enCamino = almacenes.reduce((n, a) => n + (a.transitoTotal ?? a.cantidadEnTransito), 0);
  const disponible = fisica - reservada;
  const enMl = almacenes[0]?.variante.unidad === "ML";
  const u = enMl ? " ml" : "";

  return (
    <>
      <div className="stock-overlay" onClick={onClose} />
      <aside className="exp-panel" role="dialog" aria-label={`Detalle de ${titulo}`}>
        <header className="exp-head">
          <div className="exp-thumb">{imagen ? <img src={imagen} alt="" /> : iniciales(titulo)}</div>
          <div className="exp-head-txt">
            <span>{[marca, categoria].filter(Boolean).join(" · ")}</span>
            <h2>{titulo}</h2>
            {atributos && <p>{atributos}</p>}
          </div>
          <button type="button" className="exp-cerrar" aria-label="Cerrar" onClick={onClose}>
            <Icono d={ICONO.cerrar} size={16} />
          </button>
        </header>

        {cargando || !detalle ? (
          <p className="cell-muted" style={{ padding: "0 24px" }}>
            Cargando...
          </p>
        ) : (
          <div className="exp-body">
            <div className="exp-acciones" style={{ gridTemplateColumns: `repeat(${onDecants ? 4 : 3}, minmax(0, 1fr))` }}>
              <button type="button" className="exp-accion exp-accion--principal" onClick={onSolicitar}>
                <Icono d={ICONO.mas} />
                Solicitar
              </button>
              <button type="button" className="exp-accion" disabled={!principal} onClick={() => principal && onTrasladar(principal)}>
                <Icono d={ICONO.mover} />
                Trasladar
              </button>
              <button type="button" className="exp-accion" disabled={!principal} onClick={() => principal && onProbador(principal)}>
                <Icono d={ICONO.probador} />
                Probador
              </button>
              {onDecants && (
                <button type="button" className="exp-accion" disabled={!principal || principal.variante.unidad !== "PZA"} onClick={() => principal && onDecants(principal)}>
                  <Icono d={ICONO.gota} />
                  Decants
                </button>
              )}
            </div>
            {conDisponible.length > 1 && (
              <p className="exp-aviso">Trasladar, Probador y Decants usan el almacén con más disponible ({principal?.almacen.nombre}). Para otro almacén, usa los botones de cada uno abajo.</p>
            )}

            <Seccion titulo="Cómo está este stock">
              <div className="exp-flujo">
                <div className="exp-paso-stock">
                  <span>En camino</span>
                  <strong className="exp-azul">
                    {enCamino}
                    {u}
                  </strong>
                </div>
                <span className="exp-flecha">
                  <Icono d={ICONO.siguiente} size={14} />
                </span>
                <div className="exp-paso-stock">
                  <span>En almacén</span>
                  <strong>
                    {fisica}
                    {u}
                  </strong>
                </div>
                <span className="exp-flecha">
                  <Icono d={ICONO.siguiente} size={14} />
                </span>
                <div className="exp-paso-stock">
                  <span>Reservadas</span>
                  <strong className="exp-dorado">
                    {reservada}
                    {u}
                  </strong>
                </div>
                <span className="exp-flecha">
                  <Icono d={ICONO.siguiente} size={14} />
                </span>
                <div className="exp-paso-stock exp-paso-stock--disp">
                  <span>Disponibles</span>
                  <strong className="exp-verde">
                    {disponible}
                    {u}
                  </strong>
                </div>
              </div>
              <div className="exp-kpis">
                <div>
                  <span>Valor del stock</span>
                  <strong>{bs(detalle.valorBs)}</strong>
                </div>
                <div>
                  <span>Costo promedio</span>
                  <strong>{bs(detalle.costoPromedioBs)}</strong>
                </div>
              </div>
            </Seccion>

            {almacenes.length > 0 && (
              <Seccion titulo="Por almacén">
                <div className="exp-lista">
                  {almacenes.map((a) => {
                    const disp = a.cantidadFisica - a.cantidadReservada;
                    const transito = a.transitoTotal ?? a.cantidadEnTransito;
                    const transitoRes = a.transitoReservado ?? a.cantidadReservadaTransito;
                    const total = Math.max(1, a.cantidadFisica + transito);
                    return (
                      <div className="exp-alm" key={a.almacenId}>
                        <div className="exp-alm-head">
                          <strong>{a.almacen.nombre}</strong>
                          <span>
                            {a.cantidadFisica}
                            {u} físicas
                          </span>
                        </div>
                        <div className="exp-bar" aria-hidden="true">
                          <i style={{ width: `${(Math.max(0, disp) / total) * 100}%` }} />
                          <i style={{ width: `${(a.cantidadReservada / total) * 100}%` }} />
                          <i style={{ width: `${(transito / total) * 100}%` }} />
                        </div>
                        <div className="exp-alm-nums">
                          <span>
                            <b className="exp-verde">{disp}{u}</b> disponibles
                          </span>
                          <span>
                            <b className="exp-dorado">{a.cantidadReservada}{u}</b> reservadas
                          </span>
                          <span>
                            <b className="exp-azul">{transito}</b> en camino
                            {transito > 0 && (
                              <em>
                                {" "}
                                ({Math.max(0, transito - transitoRes)} libres · {Math.min(transitoRes, transito)} apartadas)
                              </em>
                            )}
                          </span>
                        </div>
                        {disp > 0 && (
                          <div className="exp-alm-acc">
                            <button type="button" className="action-btn" onClick={() => onTrasladar(a)}>
                              Trasladar
                            </button>
                            <button type="button" className="action-btn" onClick={() => onProbador(a)}>
                              Probador
                            </button>
                            {onDecants && a.variante.unidad === "PZA" && (
                              <button type="button" className="action-btn" onClick={() => onDecants(a)}>
                                Decants
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Seccion>
            )}

            <Seccion titulo="Quién lo tiene apartado" nota="Ventas aprobadas que ya tienen unidades apartadas.">
              {detalle.reservas.length === 0 ? (
                <p className="exp-vacio">Nada reservado.</p>
              ) : (
                <div className="exp-lista">
                  {detalle.reservas.map((r) => {
                    const cliente = r.proformaDetalle.proforma.cliente?.nombre ?? "Sin cliente";
                    return (
                      <div className="exp-item" key={r.id}>
                        <div className="exp-avatar">{iniciales(cliente)}</div>
                        <div className="exp-item-txt">
                          <strong>{cliente}</strong>
                          <span>
                            Nota{" "}
                            <Link href={`/dashboard/proformas/${r.proformaDetalle.proforma.id}`} className="link-button">
                              {r.proformaDetalle.proforma.codigo}
                            </Link>{" "}
                            · {r.almacen?.nombre ?? "—"}
                            {r.origen === "EN_TRANSITO" ? " · en tránsito" : ""}
                          </span>
                        </div>
                        <b className="exp-cant">{r.cantidad}</b>
                      </div>
                    );
                  })}
                </div>
              )}
            </Seccion>

            {detalle.faltantes.length > 0 && (
              <Seccion titulo="Ventas esperando este producto" nota="Faltantes que todavía no tienen stock reservado.">
                <div className="exp-lista">
                  {detalle.faltantes.map((f) => {
                    const cliente = f.proformaDetalle.proforma.cliente?.nombre ?? "Sin cliente";
                    return (
                      <div className="exp-item" key={f.id}>
                        <div className="exp-avatar exp-avatar--espera">{iniciales(cliente)}</div>
                        <div className="exp-item-txt">
                          <strong>{cliente}</strong>
                          <span>
                            Nota{" "}
                            <Link href={`/dashboard/proformas/${f.proformaDetalle.proforma.id}`} className="link-button">
                              {f.proformaDetalle.proforma.codigo}
                            </Link>
                            {f.compraDetalle ? ` · compra ${f.compraDetalle.proforma.codigo}` : " · sin compra"}
                          </span>
                        </div>
                        <b className="exp-cant">{f.cantidad}</b>
                      </div>
                    );
                  })}
                </div>
              </Seccion>
            )}

            <Seccion titulo="Lo que viene" nota="Compras aprobadas de este producto que todavía no terminaron de llegar.">
              {detalle.enCamino.length === 0 ? (
                <p className="exp-vacio">No hay compras pendientes.</p>
              ) : (
                <div className="exp-lista">
                  {detalle.enCamino.map((c) => (
                    <div className="exp-camino" key={c.id}>
                      <div className="exp-camino-head">
                        <Link href={`/dashboard/proformas/${c.compra.id}`} className="link-button">
                          {c.compra.codigo}
                        </Link>
                        <span>
                          {c.proveedor?.nombre ?? "Sin proveedor"}
                          {c.compra.almacen ? ` · va a ${c.compra.almacen.nombre}` : ""}
                        </span>
                        <b className="exp-cant">{c.pendiente} u.</b>
                      </div>
                      <div className="exp-pasos">
                        <Paso etiqueta="Comprado" valor={c.cantidad} total={c.cantidad} />
                        <Paso etiqueta="Recogido" valor={c.recogido} total={c.cantidad} />
                        <Paso etiqueta="Enviado" valor={c.enviado} total={c.cantidad} />
                        <Paso etiqueta="Llegó" valor={c.recibido} total={c.cantidad} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Seccion>

            {detalle.solicitudes.length > 0 && (
              <Seccion titulo="Solicitudes de stock abiertas">
                <div className="exp-lista">
                  {detalle.solicitudes.map((s) => (
                    <div className="exp-item" key={s.id}>
                      <div className="exp-item-txt">
                        <strong>
                          <Link href={`/dashboard/stock/solicitudes/${s.solicitud.id}`} className="link-button">
                            {s.solicitud.codigo}
                          </Link>
                        </strong>
                        <span>{s.compraDetalle ? `Compra ${s.compraDetalle.proforma.codigo}` : "Sin comprar"}</span>
                      </div>
                      <b className="exp-cant">{s.cantidad - s.cantidadRecibida}</b>
                    </div>
                  ))}
                </div>
              </Seccion>
            )}

            <Seccion
              titulo="Lotes con saldo"
              nota="De dónde salió lo que hay, con su costo. Las ventas consumen los lotes más antiguos primero."
              accion={
                <button type="button" className="link-button" onClick={onVerLotes}>
                  Ver historial completo
                </button>
              }
            >
              {detalle.lotes.length === 0 ? (
                <p className="exp-vacio">No hay lotes con saldo.</p>
              ) : (
                <div className="exp-lista">
                  {detalle.lotes.map((l) => (
                    <div className="exp-item" key={l.id}>
                      <div className="exp-item-txt">
                        <strong>
                          <Link href={`/dashboard/proformas/${l.proformaDetalle.proforma.id}`} className="link-button">
                            {l.proformaDetalle.proforma.codigo}
                          </Link>
                          <span className="exp-item-sub"> · {l.proformaDetalle.proveedor?.nombre ?? "—"}</span>
                        </strong>
                        <span>
                          {formatDate(l.fecha)} · {l.almacen.nombre}
                        </span>
                      </div>
                      <div className="exp-lote-num">
                        <b>
                          {l.cantidadDisponible}
                          <small> de {l.cantidadInicial}</small>
                        </b>
                        <span>{bs(l.costoBs)} c/u</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Seccion>
          </div>
        )}
      </aside>
    </>
  );
}
