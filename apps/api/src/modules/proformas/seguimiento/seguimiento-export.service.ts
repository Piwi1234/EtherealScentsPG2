import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { SeguimientoService } from "./seguimiento.service";
import { QuerySeguimientoDto } from "./dto/query-seguimiento.dto";

export type VistaSeguimiento = "pedidos" | "solicitudes" | "stock";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E6F7" } };

const ESTADO_LABEL: Record<string, string> = {
  SIN_COMPRA: "Sin compra",
  EN_PREPARACION: "En preparación",
  COMPRADO: "Comprado",
  RECOGIDO: "Recogido",
  EN_TRANSITO: "Enviado",
  RECIBIDA: "Recibida",
};

type VarianteTexto = {
  options: { optionValue: { value: string; attribute: { name: string } } }[];
  product: {
    name: string;
    brand: { name: string } | null;
    attributeValues: { attribute: { mostrarEnProforma: boolean; orden: number }; option: { value: string } | null; valueText: string | null; valueNumber: unknown; valueBoolean: boolean | null }[];
    variantOptionValues: { value: string; attribute: { mostrarEnProforma: boolean; variantMode: string; orden: number } }[];
  };
};

/** "Tamaño: 90 ML, Concentracion: Eau de Parfum" — lo que distingue la variante más los atributos que se muestran en proforma. */
function atributosTexto(v: VarianteTexto): string {
  const propias = v.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados: string[] = [];
  for (const pv of v.product.attributeValues) {
    if (!pv.attribute.mostrarEnProforma) continue;
    const valor = pv.option ? pv.option.value : pv.valueText ?? pv.valueNumber ?? (pv.valueBoolean ? "Sí" : pv.valueBoolean === false ? "No" : "");
    if (valor !== "") heredados.push(String(valor));
  }
  for (const m of v.product.variantOptionValues) {
    if (m.attribute.mostrarEnProforma && m.attribute.variantMode === "MULTI_VALUE") heredados.push(m.value);
  }
  return [...propias, ...heredados].join(", ");
}

function fecha(value: Date | string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

type Columna = { header: string; width: number; num?: boolean };

/**
 * Excel de Seguimiento con la misma lista y los mismos filtros que se ven en pantalla (estado, cliente, producto o marca,
 * categoría y empresa), sin paginar: todas las filas que cumplen el filtro.
 */
@Injectable()
export class SeguimientoExportService {
  constructor(private readonly seguimiento: SeguimientoService) {}

  /** Recorre todas las páginas del listado (el servidor pagina de a 100 como máximo). */
  private async todas<T>(pedir: (query: QuerySeguimientoDto) => Promise<{ items: T[]; total: number }>, query: QuerySeguimientoDto): Promise<T[]> {
    const filas: T[] = [];
    for (let page = 1; page < 500; page++) {
      const r = await pedir({ ...query, page, limit: 100 });
      filas.push(...r.items);
      if (r.items.length === 0 || filas.length >= r.total) break;
    }
    return filas;
  }

  async generar(vista: VistaSeguimiento, query: QuerySeguimientoDto): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const nombreHoja = vista === "pedidos" ? "Pedidos de clientes" : vista === "solicitudes" ? "Stock solicitado" : "Stock en compra";
    const sheet = wb.addWorksheet(nombreHoja);
    let columnas: Columna[];
    let filas: (string | number)[][];

    if (vista === "pedidos") {
      const items = await this.todas((q) => this.seguimiento.findPendientes(q), query);
      columnas = [
        { header: "Fecha", width: 12 },
        { header: "Nota", width: 11 },
        { header: "Cliente", width: 30 },
        { header: "Marca", width: 16 },
        { header: "Producto", width: 34 },
        { header: "Atributos", width: 34 },
        { header: "Cantidad", width: 10, num: true },
        { header: "Estado", width: 20 },
        { header: "Precio compra $", width: 15, num: true },
        { header: "Recogidas", width: 10, num: true },
        { header: "Enviadas", width: 10, num: true },
        { header: "Compra", width: 11 },
        { header: "Proveedor", width: 22 },
        { header: "Envío", width: 14 },
      ];
      filas = items.map((i) => {
        const v = i.proformaDetalle.variante;
        const envios = Array.from(new Set((i.compraDetalle?.envioItems ?? []).map((e) => e.envio.codigo)));
        return [
          fecha(i.proformaDetalle.proforma.fecha),
          i.proformaDetalle.proforma.codigo,
          i.proformaDetalle.proforma.cliente?.nombre ?? "—",
          v.product.brand?.name ?? "—",
          v.product.name,
          atributosTexto(v),
          i.cantidad,
          ESTADO_LABEL[i.estadoPedido] ?? i.estadoPedido,
          i.estadoPedido === "SIN_COMPRA" ? Number(v.purchasePrice) : "",
          i.recogidas,
          i.enviadas,
          i.compraDetalle?.proforma.codigo ?? "—",
          i.compraDetalle?.proveedor?.nombre ?? "—",
          envios.join(", ") || "—",
        ];
      });
    } else if (vista === "solicitudes") {
      const items = await this.todas((q) => this.seguimiento.findStockSolicitado(q), query);
      columnas = [
        { header: "Fecha", width: 12 },
        { header: "Solicitud", width: 11 },
        { header: "Solicitó", width: 22 },
        { header: "Marca", width: 16 },
        { header: "Producto", width: 34 },
        { header: "Atributos", width: 34 },
        { header: "Cantidad", width: 10, num: true },
        { header: "Estado", width: 20 },
        { header: "Precio compra $", width: 15, num: true },
        { header: "Recogidas", width: 10, num: true },
        { header: "Enviadas", width: 10, num: true },
        { header: "Compra", width: 11 },
        { header: "Proveedor", width: 22 },
        { header: "Envío", width: 14 },
      ];
      filas = items.map((i) => {
        const envios = Array.from(new Set((i.compraDetalle?.envioItems ?? []).map((e) => e.envio.codigo)));
        return [
          fecha(i.solicitud.createdAt),
          i.solicitud.codigo,
          i.solicitud.creadoPor.nombre,
          i.variante.product.brand?.name ?? "—",
          i.variante.product.name,
          atributosTexto(i.variante),
          i.cantidad,
          ESTADO_LABEL[i.estadoLinea] ?? i.estadoLinea,
          i.estadoLinea === "SIN_COMPRA" ? Number(i.variante.purchasePrice) : "",
          i.recogidas,
          i.enviadas,
          i.compraDetalle?.proforma.codigo ?? "—",
          i.compraDetalle?.proveedor?.nombre ?? "—",
          envios.join(", ") || "—",
        ];
      });
    } else {
      const items = await this.todas((q) => this.seguimiento.findStockPedido(q), query);
      columnas = [
        { header: "Fecha", width: 12 },
        { header: "Compra", width: 11 },
        { header: "Proveedor", width: 22 },
        { header: "Marca", width: 16 },
        { header: "Producto", width: 34 },
        { header: "Atributos", width: 34 },
        { header: "Cantidad", width: 10, num: true },
        { header: "Estado", width: 16 },
        { header: "Recogidas", width: 10, num: true },
        { header: "Envío", width: 18 },
      ];
      filas = items.map((i) => [
        fecha(i.proforma.fecha),
        i.proforma.codigo,
        i.proveedor?.nombre ?? "—",
        i.variante.product.brand?.name ?? "—",
        i.variante.product.name,
        atributosTexto(i.variante),
        i.cantidad,
        ESTADO_LABEL[i.estadoStock] ?? i.estadoStock,
        i.recogidas,
        i.envios.map((e) => e.codigo).join(", ") || "Sin envío",
      ]);
    }

    sheet.columns = columnas.map((c) => ({ header: c.header, width: c.width }));
    const header = sheet.getRow(1);
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.fill = HEADER_FILL;
    });
    for (const f of filas) sheet.addRow(f);
    columnas.forEach((c, idx) => {
      if (c.num) sheet.getColumn(idx + 1).alignment = { horizontal: "center" };
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
