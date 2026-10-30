"use client";

import Link from "next/link";
import type { StockDetalle, StockRow } from "../../lib/types";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

function bs(value: number | null): string {
  return value === null ? "—" : `Bs ${value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="stock-panel-sec">
      <h3>{titulo}</h3>
      {nota && <p className="cell-muted" style={{ fontSize: 12, margin: "0 0 8px" }}>{nota}</p>}
      {children}
    </section>
  );
}

/**
 * Detalle de un producto de Existencias: dónde está, de qué lotes y a qué costo, para qué ventas está reservado, qué
 * ventas lo esperan, qué compras vienen en camino y qué solicitudes de stock lo piden.
 */
export function ExistenciaPanel({
  titulo,
  subtitulo,
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
  subtitulo: string | null;
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
  return (
    <>
      <div className="stock-overlay" onClick={onClose} />
      <aside className="stock-panel" role="dialog" aria-label={`Detalle de ${titulo}`}>
        <header className="stock-panel-head">
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <span className="cell-muted">{subtitulo}</span>}
          </div>
          <button type="button" className="link-button" onClick={onClose}>
            Cerrar
          </button>
        </header>

        {cargando || !detalle ? (
          <p className="cell-muted">Cargando...</p>
        ) : (
          <div className="stock-panel-body">
            <div className="stock-panel-kpis">
              <div>
                <span>Valor del stock</span>
                <strong>{bs(detalle.valorBs)}</strong>
              </div>
              <div>
                <span>Costo promedio</span>
                <strong>{bs(detalle.costoPromedioBs)}</strong>
              </div>
            </div>

            <div className="stock-panel-actions">
              <button type="button" className="action-btn" onClick={onSolicitar}>
                Solicitar stock
              </button>
              <button type="button" className="action-btn" onClick={onVerLotes}>
                Ver historial de lotes
              </button>
            </div>

            <Seccion titulo="Por almacén">
              <table className="table table-minimal table-compact">
                <thead>
                  <tr>
                    <th>Almacén</th>
                    <th className="num">Física</th>
                    <th className="num">Reserv.</th>
                    <th className="num">Tránsito</th>
                    <th className="num" title="Lo que viaja y todavía no está apartado ni ligado a una nota">Trán. disp.</th>
                    <th className="num" title="De lo que viaja, lo apartado por ventas o ligado a notas">Trán. reserv.</th>
                    <th className="num">Disp.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.almacenes.filter((a) => a.cantidadFisica > 0 || a.cantidadReservada > 0 || (a.transitoTotal ?? a.cantidadEnTransito) > 0).map((a) => (
                    <tr key={a.almacenId}>
                      <td>{a.almacen.nombre}</td>
                      <td className="num">{a.cantidadFisica}</td>
                      <td className="num">{a.cantidadReservada}</td>
                      <td className="num">{a.transitoTotal ?? a.cantidadEnTransito}</td>
                      <td className="num">
                        {Math.max(0, (a.transitoTotal ?? a.cantidadEnTransito) - (a.transitoReservado ?? a.cantidadReservadaTransito))}
                      </td>
                      <td className="num">{a.transitoReservado ?? a.cantidadReservadaTransito}</td>
                      <td className="num cell-primary">{a.cantidadFisica - a.cantidadReservada}</td>
                      <td className="num">
                        {a.cantidadFisica - a.cantidadReservada > 0 && (
                          <span style={{ display: "inline-flex", gap: 6 }}>
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
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Seccion>

            <Seccion titulo="Reservado para" nota="Ventas aprobadas que ya tienen unidades apartadas.">
              {detalle.reservas.length === 0 ? (
                <p className="cell-muted">Nada reservado.</p>
              ) : (
                <ul className="stock-panel-list">
                  {detalle.reservas.map((r) => (
                    <li key={r.id}>
                      <span>
                        <Link href={`/dashboard/proformas/${r.proformaDetalle.proforma.id}`} className="link-button">
                          {r.proformaDetalle.proforma.codigo}
                        </Link>{" "}
                        · {r.proformaDetalle.proforma.cliente?.nombre ?? "Sin cliente"}
                        <span className="cell-muted"> · {r.almacen?.nombre ?? "—"}{r.origen === "EN_TRANSITO" ? " · en tránsito" : ""}</span>
                      </span>
                      <strong>{r.cantidad}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Seccion>

            {detalle.faltantes.length > 0 && (
              <Seccion titulo="Ventas esperando este producto" nota="Faltantes que todavía no tienen stock reservado.">
                <ul className="stock-panel-list">
                  {detalle.faltantes.map((f) => (
                    <li key={f.id}>
                      <span>
                        <Link href={`/dashboard/proformas/${f.proformaDetalle.proforma.id}`} className="link-button">
                          {f.proformaDetalle.proforma.codigo}
                        </Link>{" "}
                        · {f.proformaDetalle.proforma.cliente?.nombre ?? "Sin cliente"}
                        <span className="cell-muted">
                          {f.compraDetalle ? ` · compra ${f.compraDetalle.proforma.codigo}` : " · sin compra"}
                        </span>
                      </span>
                      <strong>{f.cantidad}</strong>
                    </li>
                  ))}
                </ul>
              </Seccion>
            )}

            <Seccion titulo="Viene en camino" nota="Compras aprobadas de este producto que todavía no terminaron de llegar.">
              {detalle.enCamino.length === 0 ? (
                <p className="cell-muted">No hay compras pendientes.</p>
              ) : (
                <ul className="stock-panel-list">
                  {detalle.enCamino.map((c) => (
                    <li key={c.id}>
                      <span>
                        <Link href={`/dashboard/proformas/${c.compra.id}`} className="link-button">
                          {c.compra.codigo}
                        </Link>{" "}
                        · {c.proveedor?.nombre ?? "Sin proveedor"}
                        <div className="cell-muted" style={{ fontSize: 12 }}>
                          Comprado {c.cantidad} · recogido {c.recogido} · enviado {c.enviado} · llegó {c.recibido}
                          {c.compra.almacen ? ` · va a ${c.compra.almacen.nombre}` : ""}
                        </div>
                      </span>
                      <strong>{c.pendiente}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Seccion>

            {detalle.solicitudes.length > 0 && (
              <Seccion titulo="Solicitudes de stock abiertas">
                <ul className="stock-panel-list">
                  {detalle.solicitudes.map((s) => (
                    <li key={s.id}>
                      <span>
                        <Link href={`/dashboard/stock/solicitudes/${s.solicitud.id}`} className="link-button">
                          {s.solicitud.codigo}
                        </Link>
                        <span className="cell-muted">{s.compraDetalle ? ` · compra ${s.compraDetalle.proforma.codigo}` : " · sin comprar"}</span>
                      </span>
                      <strong>{s.cantidad - s.cantidadRecibida}</strong>
                    </li>
                  ))}
                </ul>
              </Seccion>
            )}

            <Seccion titulo="Lotes con saldo" nota="De dónde salió lo que hay, con su costo. Las ventas consumen los lotes más antiguos primero.">
              {detalle.lotes.length === 0 ? (
                <p className="cell-muted">No hay lotes con saldo.</p>
              ) : (
                <table className="table table-minimal table-compact">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Compra / proveedor</th>
                      <th>Almacén</th>
                      <th className="num">Saldo</th>
                      <th className="num">Costo Bs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.lotes.map((l) => (
                      <tr key={l.id}>
                        <td className="cell-muted">{formatDate(l.fecha)}</td>
                        <td>
                          <Link href={`/dashboard/proformas/${l.proformaDetalle.proforma.id}`} className="link-button">
                            {l.proformaDetalle.proforma.codigo}
                          </Link>
                          <div className="cell-muted" style={{ fontSize: 12 }}>{l.proformaDetalle.proveedor?.nombre ?? "—"}</div>
                        </td>
                        <td className="cell-muted">{l.almacen.nombre}</td>
                        <td className="num">
                          {l.cantidadDisponible}
                          <span className="cell-muted"> de {l.cantidadInicial}</span>
                        </td>
                        <td className="num">{bs(l.costoBs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Seccion>
          </div>
        )}
      </aside>
    </>
  );
}
