import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PrismaService } from "../../common/prisma.service";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E6F7" } };

const exportInclude = {
  variante: {
    select: {
      variantCode: true,
      unidad: true,
      product: {
        select: {
          name: true,
          productCode: true,
          brand: { select: { name: true } },
          category: { select: { name: true, parent: { select: { name: true } } } },
          attributeValues: { include: { attribute: true, option: true } },
          variantOptionValues: { include: { attribute: true } },
        },
      },
      options: { include: { optionValue: { include: { attribute: true } } } },
    },
  },
  almacen: { select: { nombre: true } },
} as const;

type ExportPv = {
  attributeId: string;
  valueText: string | null;
  valueNumber: unknown;
  valueBoolean: boolean | null;
  option: { value: string } | null;
  attribute: { name: string; orden: number; mostrarEnProforma: boolean };
};

type ExportOv = {
  attributeId: string;
  value: string;
  attribute: { name: string; orden: number; mostrarEnProforma: boolean; variantMode: string };
};

function formatValue(pv: ExportPv): string {
  if (pv.option) return pv.option.value;
  if (pv.valueText !== null) return pv.valueText;
  if (pv.valueNumber !== null) return String(pv.valueNumber);
  if (pv.valueBoolean !== null) return pv.valueBoolean ? "Sí" : "No";
  return "—";
}

/** Mismo criterio que `formatAtributosVisibles` del frontend (AtributosVisibles.tsx): atributos
 * marcados mostrarEnProforma, ordenados por `orden` — replicado acá porque el export corre en el
 * backend y no puede importar componentes de apps/web. */
function atributosLabel(attributeValues: ExportPv[], variantOptionValues: ExportOv[]): string {
  const porAtributo = new Map<string, { orden: number; nombre: string; valor: string }>();
  for (const pv of attributeValues) {
    if (!pv.attribute.mostrarEnProforma) continue;
    const existing = porAtributo.get(pv.attributeId);
    if (existing) existing.valor = `${existing.valor}, ${formatValue(pv)}`;
    else porAtributo.set(pv.attributeId, { orden: pv.attribute.orden, nombre: pv.attribute.name, valor: formatValue(pv) });
  }
  for (const ov of variantOptionValues) {
    if (!ov.attribute.mostrarEnProforma || ov.attribute.variantMode !== "MULTI_VALUE") continue;
    const existing = porAtributo.get(ov.attributeId);
    if (existing) existing.valor = `${existing.valor}, ${ov.value}`;
    else porAtributo.set(ov.attributeId, { orden: ov.attribute.orden, nombre: ov.attribute.name, valor: ov.value });
  }
  return Array.from(porAtributo.values())
    .sort((a, b) => a.orden - b.orden)
    .map((a) => `${a.nombre}: ${a.valor}`)
    .join(", ");
}

@Injectable()
export class StockExportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Excel con una hoja por categoría raíz (Perfumes, Vapes, etc.), todas las existencias con stock
   * físico > 0 en cualquier almacén, sin filtrar por almacén — mismo criterio de "solo con stock" que
   * ya usa la tabla de Existencias del panel. */
  async buildExport(): Promise<Buffer> {
    const rows = await this.prisma.stock.findMany({
      where: { cantidadFisica: { gt: 0 } },
      orderBy: [{ variante: { product: { brand: { name: "asc" } } } }, { variante: { product: { name: "asc" } } }],
      include: exportInclude,
    });

    const porRaiz = new Map<string, typeof rows>();
    for (const row of rows) {
      const raiz = row.variante.product.category?.parent?.name ?? row.variante.product.category?.name ?? "Sin categoría";
      const grupo = porRaiz.get(raiz);
      if (grupo) grupo.push(row);
      else porRaiz.set(raiz, [row]);
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Ethereal Scents";
    wb.created = new Date();

    for (const [raiz, grupoRows] of Array.from(porRaiz.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      // Excel no admite "/", "\", "?", "*", "[", "]", ":" en nombres de hoja, ni más de 31 caracteres.
      const sheetName = raiz.replace(/[/\\?*[\]:]/g, "-").slice(0, 31);
      const sheet = wb.addWorksheet(sheetName);
      sheet.columns = [
        { header: "Subcategoría", key: "subcategoria", width: 22 },
        { header: "Marca", key: "marca", width: 22 },
        { header: "Producto", key: "producto", width: 32 },
        { header: "Atributos", key: "atributos", width: 40 },
        { header: "Código", key: "codigo", width: 16 },
        { header: "Almacén", key: "almacen", width: 20 },
        { header: "Física", key: "fisica", width: 12 },
        { header: "Reservada", key: "reservada", width: 12 },
        { header: "Disponible", key: "disponible", width: 12 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
      sheet.views = [{ state: "frozen", ySplit: 1 }];

      for (const row of grupoRows) {
        const disponible = row.cantidadFisica - row.cantidadReservada;
        const opciones = row.variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
        const heredados = atributosLabel(row.variante.product.attributeValues, row.variante.product.variantOptionValues);
        const atributos = [...opciones, ...(heredados ? [heredados] : [])].join(", ");
        sheet.addRow({
          subcategoria: row.variante.product.category?.name ?? "—",
          marca: row.variante.product.brand?.name ?? "—",
          producto: row.variante.product.name,
          atributos: atributos || "—",
          codigo: row.variante.variantCode || row.variante.product.productCode,
          almacen: row.almacen.nombre,
          fisica: row.variante.unidad === "ML" ? `${row.cantidadFisica} ml` : row.cantidadFisica,
          reservada: row.variante.unidad === "ML" ? `${row.cantidadReservada} ml` : row.cantidadReservada,
          disponible: row.variante.unidad === "ML" ? `${disponible} ml` : disponible,
        });
      }
    }

    if (wb.worksheets.length === 0) {
      const sheet = wb.addWorksheet("Existencias");
      sheet.addRow(["Sin existencias con stock físico mayor a 0."]);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
