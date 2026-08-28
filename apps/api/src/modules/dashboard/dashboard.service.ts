import { Injectable } from "@nestjs/common";
import { EstadoCuentaPorCobrar, EstadoProforma, NaturalezaMovimiento, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";

// Solo cuentan como "reales" las proformas aprobadas o completadas — ni borrador (todavía no pasó
// nada) ni anulada (se deshizo). Mismo criterio en toda esta clase.
const ESTADOS_REALES = [EstadoProforma.APROBADA, EstadoProforma.COMPLETADA];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Primer día del mes, `meses` atrás (incluyendo el actual) — ej. meses=12 arranca hace 11 meses. */
function monthsAgoStart(meses: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (meses - 1));
  return d;
}

function fillMonths(from: Date, meses: number, data: Map<string, number>): { mes: string; total: number }[] {
  const result: { mes: string; total: number }[] = [];
  const d = new Date(from);
  for (let i = 0; i < meses; i++) {
    const key = monthKey(d);
    result.push({ mes: key, total: round2(data.get(key) ?? 0) });
    d.setMonth(d.getMonth() + 1);
  }
  return result;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ventas mensuales en Bs (opcionalmente filtrado por empresa) — últimos `meses` meses. */
  async ventasMensuales(empresaId: string | undefined, meses: number) {
    const from = monthsAgoStart(meses);
    const detalles = await this.prisma.proformaDetalle.findMany({
      where: {
        proforma: { tipo: TipoProforma.VENTA, estado: { in: ESTADOS_REALES }, fecha: { gte: from }, empresaId },
      },
      select: { subtotal: true, proforma: { select: { fecha: true } } },
    });
    const byMonth = new Map<string, number>();
    for (const d of detalles) {
      const key = monthKey(d.proforma.fecha);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(d.subtotal));
    }
    return fillMonths(from, meses, byMonth);
  }

  /** Compras mensuales en Bs — los montos de compra se cargan en $ (precioCompra + costos), se
   * convierten con el tipo de cambio propio de CADA proforma de compra (tipoCambioProf), no el del
   * sistema (así no cambian retroactivamente si el tipo de cambio general se actualiza después). */
  async comprasMensuales(empresaId: string | undefined, meses: number) {
    const from = monthsAgoStart(meses);
    const detalles = await this.prisma.proformaDetalle.findMany({
      where: {
        proforma: { tipo: TipoProforma.COMPRA, estado: { in: ESTADOS_REALES }, fecha: { gte: from }, empresaId },
      },
      select: { subtotal: true, proforma: { select: { fecha: true, tipoCambioProf: true } } },
    });
    const byMonth = new Map<string, number>();
    for (const d of detalles) {
      const tc = Number(d.proforma.tipoCambioProf ?? 0);
      const key = monthKey(d.proforma.fecha);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(d.subtotal) * tc);
    }
    return fillMonths(from, meses, byMonth);
  }

  /** Cantidad de productos por categoría (la propia del producto, no la raíz). */
  async productosPorCategoria() {
    const products = await this.prisma.product.findMany({ select: { category: { select: { id: true, name: true } } } });
    const byCategory = new Map<string, { categoriaId: string; categoria: string; total: number }>();
    for (const p of products) {
      const existing = byCategory.get(p.category.id);
      if (existing) existing.total += 1;
      else byCategory.set(p.category.id, { categoriaId: p.category.id, categoria: p.category.name, total: 1 });
    }
    return Array.from(byCategory.values()).sort((a, b) => b.total - a.total);
  }

  async proformasAprobadas(from: Date, to: Date) {
    return this.prisma.proforma.count({ where: { estado: EstadoProforma.APROBADA, fecha: { gte: from, lte: to } } });
  }

  async proformasCompletadasPorMes(from: Date, to: Date) {
    const proformas = await this.prisma.proforma.findMany({
      where: { estado: EstadoProforma.COMPLETADA, fecha: { gte: from, lte: to } },
      select: { fecha: true },
    });
    const byMonth = new Map<string, number>();
    for (const p of proformas) {
      const key = monthKey(p.fecha);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    return Array.from(byMonth.entries())
      .map(([mes, total]) => ({ mes, total }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }

  async ventasPorCategoria(from: Date, to: Date) {
    const detalles = await this.prisma.proformaDetalle.findMany({
      where: { proforma: { tipo: TipoProforma.VENTA, estado: { in: ESTADOS_REALES }, fecha: { gte: from, lte: to } } },
      select: { subtotal: true, variante: { select: { product: { select: { category: { select: { id: true, name: true } } } } } } },
    });
    const byCategory = new Map<string, { categoria: string; total: number }>();
    for (const d of detalles) {
      const cat = d.variante.product.category;
      const val = Number(d.subtotal);
      const existing = byCategory.get(cat.id);
      if (existing) existing.total += val;
      else byCategory.set(cat.id, { categoria: cat.name, total: val });
    }
    return Array.from(byCategory.values())
      .map((c) => ({ ...c, total: round2(c.total) }))
      .sort((a, b) => b.total - a.total);
  }

  /** Top 10 clientes por total comprado en un mes puntual ("YYYY-MM"). */
  async topClientes(month: string) {
    const [y, m] = month.split("-").map(Number);
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 1);
    const detalles = await this.prisma.proformaDetalle.findMany({
      where: {
        proforma: { tipo: TipoProforma.VENTA, estado: { in: ESTADOS_REALES }, fecha: { gte: from, lt: to } },
      },
      select: { subtotal: true, proforma: { select: { cliente: { select: { id: true, nombre: true } } } } },
    });
    const byClient = new Map<string, { cliente: string; total: number }>();
    for (const d of detalles) {
      const cli = d.proforma.cliente;
      if (!cli) continue;
      const val = Number(d.subtotal);
      const existing = byClient.get(cli.id);
      if (existing) existing.total += val;
      else byClient.set(cli.id, { cliente: cli.nombre, total: val });
    }
    return Array.from(byClient.values())
      .map((c) => ({ ...c, total: round2(c.total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }

  /** Margen bruto = ingresos (venta) - costo real de lo vendido (lotes consumidos, ver
   * LoteCompraConsumo). Solo cuenta el costo de líneas ya asignadas a un lote real (origen=STOCK) —
   * una venta con procura pendiente (sin lote consumido todavía) no tiene costo registrado aún, así
   * que su margen queda temporalmente inflado hasta que se completa la compra que la cubre. */
  async margenBruto(from: Date, to: Date) {
    const ventas = await this.prisma.proformaDetalle.findMany({
      where: { proforma: { tipo: TipoProforma.VENTA, estado: { in: ESTADOS_REALES }, fecha: { gte: from, lte: to } } },
      select: { subtotal: true, proforma: { select: { fecha: true } } },
    });
    const ingresosPorMes = new Map<string, number>();
    for (const v of ventas) {
      const key = monthKey(v.proforma.fecha);
      ingresosPorMes.set(key, (ingresosPorMes.get(key) ?? 0) + Number(v.subtotal));
    }

    const consumos = await this.prisma.loteCompraConsumo.findMany({
      where: {
        asignacion: {
          proformaDetalle: {
            proforma: { tipo: TipoProforma.VENTA, estado: { in: ESTADOS_REALES }, fecha: { gte: from, lte: to } },
          },
        },
      },
      select: {
        cantidad: true,
        loteCompra: { select: { costoUnitario: true, proformaDetalle: { select: { proforma: { select: { tipoCambioProf: true } } } } } },
        asignacion: { select: { proformaDetalle: { select: { proforma: { select: { fecha: true } } } } } },
      },
    });
    const costosPorMes = new Map<string, number>();
    for (const c of consumos) {
      const key = monthKey(c.asignacion.proformaDetalle.proforma.fecha);
      const tc = Number(c.loteCompra.proformaDetalle.proforma.tipoCambioProf ?? 0);
      const costo = c.cantidad * Number(c.loteCompra.costoUnitario) * tc;
      costosPorMes.set(key, (costosPorMes.get(key) ?? 0) + costo);
    }

    const months = Array.from(new Set([...ingresosPorMes.keys(), ...costosPorMes.keys()])).sort();
    return months.map((mes) => {
      const ingresos = ingresosPorMes.get(mes) ?? 0;
      const costos = costosPorMes.get(mes) ?? 0;
      return { mes, ingresos: round2(ingresos), costos: round2(costos), margen: round2(ingresos - costos) };
    });
  }

  async comprasPorProveedorYCategoria(from: Date, to: Date) {
    const detalles = await this.prisma.proformaDetalle.findMany({
      where: { proforma: { tipo: TipoProforma.COMPRA, estado: { in: ESTADOS_REALES }, fecha: { gte: from, lte: to } } },
      select: {
        subtotal: true,
        variante: { select: { product: { select: { category: { select: { name: true } } } } } },
        proforma: { select: { tipoCambioProf: true, proveedor: { select: { id: true, nombre: true } } } },
      },
    });
    const byKey = new Map<string, { proveedor: string; categoria: string; total: number }>();
    for (const d of detalles) {
      const proveedor = d.proforma.proveedor?.nombre ?? "Sin proveedor";
      const categoria = d.variante.product.category.name;
      const key = `${proveedor}|${categoria}`;
      const val = Number(d.subtotal) * Number(d.proforma.tipoCambioProf ?? 0);
      const existing = byKey.get(key);
      if (existing) existing.total += val;
      else byKey.set(key, { proveedor, categoria, total: val });
    }
    return Array.from(byKey.values())
      .map((r) => ({ ...r, total: round2(r.total) }))
      .sort((a, b) => b.total - a.total);
  }

  /** Valoriza el stock a costo promedio ponderado por variante (a partir de los lotes con
   * cantidadDisponible > 0) — no hay un costo "reservado" propio a nivel de lote, así que la
   * separación disponible/reservado se hace aplicando ese mismo costo promedio a cada porción de
   * Stock.cantidadFisica/cantidadReservada. */
  async stockValorizado() {
    const lotes = await this.prisma.loteCompra.findMany({
      where: { cantidadDisponible: { gt: 0 } },
      select: {
        varianteId: true,
        cantidadDisponible: true,
        costoUnitario: true,
        proformaDetalle: { select: { proforma: { select: { tipoCambioProf: true } } } },
      },
    });
    const costoPorVariante = new Map<string, { unidades: number; valorTotal: number }>();
    for (const l of lotes) {
      const tc = Number(l.proformaDetalle.proforma.tipoCambioProf ?? 0);
      const valor = l.cantidadDisponible * Number(l.costoUnitario) * tc;
      const existing = costoPorVariante.get(l.varianteId);
      if (existing) {
        existing.unidades += l.cantidadDisponible;
        existing.valorTotal += valor;
      } else {
        costoPorVariante.set(l.varianteId, { unidades: l.cantidadDisponible, valorTotal: valor });
      }
    }

    const stock = await this.prisma.stock.findMany({ select: { varianteId: true, cantidadFisica: true, cantidadReservada: true } });
    let disponibleBs = 0;
    let reservadoBs = 0;
    for (const s of stock) {
      const c = costoPorVariante.get(s.varianteId);
      const costoUnit = c && c.unidades > 0 ? c.valorTotal / c.unidades : 0;
      disponibleBs += (s.cantidadFisica - s.cantidadReservada) * costoUnit;
      reservadoBs += s.cantidadReservada * costoUnit;
    }
    return { disponibleBs: round2(disponibleBs), reservadoBs: round2(reservadoBs) };
  }

  async saldosCartera() {
    const carteras = await this.prisma.cartera.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, moneda: true, saldoActual: true },
      orderBy: { nombre: "asc" },
    });
    return carteras.map((c) => ({ id: c.id, nombre: c.nombre, moneda: c.moneda, saldo: Number(c.saldoActual) }));
  }

  /** Ingresos y egresos por cartera y por mes — en la moneda propia de cada cartera (monto no se
   * convierte entre monedas, a diferencia de compras/ventas que siempre son en Bs). */
  async ingresosEgresos(from: Date, to: Date) {
    const movimientos = await this.prisma.movimientoCartera.findMany({
      where: { fecha: { gte: from, lte: to } },
      select: { monto: true, naturaleza: true, fecha: true, cartera: { select: { id: true, nombre: true, moneda: true } } },
    });
    const byKey = new Map<string, { carteraId: string; cartera: string; moneda: string; mes: string; ingresos: number; egresos: number }>();
    for (const m of movimientos) {
      const mes = monthKey(m.fecha);
      const key = `${m.cartera.id}|${mes}`;
      const existing = byKey.get(key) ?? {
        carteraId: m.cartera.id,
        cartera: m.cartera.nombre,
        moneda: m.cartera.moneda,
        mes,
        ingresos: 0,
        egresos: 0,
      };
      if (m.naturaleza === NaturalezaMovimiento.INGRESO) existing.ingresos += Number(m.monto);
      else existing.egresos += Number(m.monto);
      byKey.set(key, existing);
    }
    return Array.from(byKey.values())
      .map((r) => ({ ...r, ingresos: round2(r.ingresos), egresos: round2(r.egresos) }))
      .sort((a, b) => a.mes.localeCompare(b.mes) || a.cartera.localeCompare(b.cartera));
  }

  async cuentasPorCobrar() {
    const result = await this.prisma.cuentaPorCobrar.aggregate({
      where: { estado: EstadoCuentaPorCobrar.PENDIENTE },
      _sum: { montoAdeudado: true },
      _count: true,
    });
    return { totalBs: round2(Number(result._sum.montoAdeudado ?? 0)), cantidad: result._count };
  }
}
