import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { DashboardService } from "./dashboard.service";

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`Fecha inválida: ${value}`);
  return parsed;
}

/** Default de 12 meses atrás (1ro del mes) hasta ahora, para todos los endpoints que reciben
 * from/to opcionales — mismo rango que usan por default los gráficos mensuales del dashboard. */
function defaultRange(fromRaw?: string, toRaw?: string): { from: Date; to: Date } {
  const defaultFrom = new Date();
  defaultFrom.setMonth(defaultFrom.getMonth() - 11);
  defaultFrom.setDate(1);
  defaultFrom.setHours(0, 0, 0, 0);
  return { from: parseDate(fromRaw, defaultFrom), to: parseDate(toRaw, new Date()) };
}

@ApiTags("dashboard")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("ventas-mensuales")
  @ApiOperation({ summary: "Total de ventas en Bs por mes, últimos N meses (default 12)." })
  ventasMensuales(@Query("empresaId") empresaId?: string, @Query("meses") meses?: string) {
    return this.dashboard.ventasMensuales(empresaId, meses ? Number(meses) : 12);
  }

  @Get("compras-mensuales")
  @ApiOperation({ summary: "Total de compras en Bs por mes, últimos N meses (default 12)." })
  comprasMensuales(@Query("empresaId") empresaId?: string, @Query("meses") meses?: string) {
    return this.dashboard.comprasMensuales(empresaId, meses ? Number(meses) : 12);
  }

  @Get("productos-por-categoria")
  @ApiOperation({ summary: "Cantidad de productos por categoría." })
  productosPorCategoria() {
    return this.dashboard.productosPorCategoria();
  }

  @Get("proformas-aprobadas")
  @ApiOperation({ summary: "Cantidad de proformas en estado APROBADA dentro de un rango de fechas." })
  proformasAprobadas(@Query("from") from?: string, @Query("to") to?: string) {
    const range = defaultRange(from, to);
    return this.dashboard.proformasAprobadas(range.from, range.to).then((cantidad) => ({ cantidad }));
  }

  @Get("proformas-completadas-por-mes")
  @ApiOperation({ summary: "Cantidad de proformas COMPLETADA por mes, dentro de un rango de fechas." })
  proformasCompletadasPorMes(@Query("from") from?: string, @Query("to") to?: string) {
    const range = defaultRange(from, to);
    return this.dashboard.proformasCompletadasPorMes(range.from, range.to);
  }

  @Get("ventas-por-categoria")
  @ApiOperation({ summary: "Total vendido en Bs por categoría, dentro de un rango de fechas." })
  ventasPorCategoria(@Query("from") from?: string, @Query("to") to?: string) {
    const range = defaultRange(from, to);
    return this.dashboard.ventasPorCategoria(range.from, range.to);
  }

  @Get("top-clientes")
  @ApiOperation({ summary: "Top 10 clientes por total comprado en un mes puntual (\"YYYY-MM\")." })
  topClientes(@Query("month") month?: string) {
    const value = month ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    return this.dashboard.topClientes(value);
  }

  @Get("margen-bruto")
  @ApiOperation({ summary: "Ingresos, costo y margen bruto en Bs por mes, dentro de un rango de fechas." })
  margenBruto(@Query("from") from?: string, @Query("to") to?: string) {
    const range = defaultRange(from, to);
    return this.dashboard.margenBruto(range.from, range.to);
  }

  @Get("compras-por-proveedor-categoria")
  @ApiOperation({ summary: "Total comprado en Bs por proveedor y categoría, dentro de un rango de fechas." })
  comprasPorProveedorYCategoria(@Query("from") from?: string, @Query("to") to?: string) {
    const range = defaultRange(from, to);
    return this.dashboard.comprasPorProveedorYCategoria(range.from, range.to);
  }

  @Get("stock-valorizado")
  @ApiOperation({ summary: "Valor en Bs del stock disponible y reservado (a costo promedio ponderado)." })
  stockValorizado() {
    return this.dashboard.stockValorizado();
  }

  @Get("saldos-cartera")
  @ApiOperation({ summary: "Saldo actual de cada cartera activa." })
  saldosCartera() {
    return this.dashboard.saldosCartera();
  }

  @Get("ingresos-egresos")
  @ApiOperation({ summary: "Ingresos y egresos por cartera y por mes, dentro de un rango de fechas." })
  ingresosEgresos(@Query("from") from?: string, @Query("to") to?: string) {
    const range = defaultRange(from, to);
    return this.dashboard.ingresosEgresos(range.from, range.to);
  }

  @Get("cuentas-por-cobrar")
  @ApiOperation({ summary: "Total en Bs de cuentas por cobrar pendientes." })
  cuentasPorCobrar() {
    return this.dashboard.cuentasPorCobrar();
  }
}
