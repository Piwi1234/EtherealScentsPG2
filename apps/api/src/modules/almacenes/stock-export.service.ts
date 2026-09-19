import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { Prisma } from "@app/database";
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
          categoryId: true,
          brand: { select: { name: true } },
          category: { select: { id: true, name: true, parentId: true } },
          attributeValues: { include: { attribute: true, option: true } },
          variantOptionValues: { include: { attribute: true } },
        },
      },
      options: { include: { optionValue: { include: { attribute: true } } } },
    },
  },
  almacen: { select: { nombre: true } },
} as const;

type ExportRow = Prisma.StockGetPayload<{ include: typeof exportInclude }>;

type ExportPv = {
  attribute: { name: string; variantMode: string };
  option: { value: string } | null;
  valueText: string | null;
  valueNumber: unknown;
  valueBoolean: boolean | null;
};

function formatValue(pv: ExportPv): string {
  if (pv.option) return pv.option.value;
  if (pv.valueText !== null) return pv.valueText;
  if (pv.valueNumber !== null) return String(pv.valueNumber);
  if (pv.valueBoolean !== null) return pv.valueBoolean ? "Sí" : "No";
  return "";
}

/** Junta las 3 fuentes de valor de atributo de una fila de stock, sin filtrar por mostrarEnProforma
 * (a diferencia de AtributosVisibles.tsx) — acá se quiere el detalle completo de inventario. Clave por
 * NOMBRE de atributo, no por id, para que dos Attribute distintos (subcategoría + raíz) con el mismo
 * nombre caigan en la misma columna — mismo criterio que "unificar columnas por nombre" en Productos. */
function buildAttributeValueMap(row: ExportRow): Map<string, string> {
  const map = new Map<string, string>();
  for (const pv of row.variante.product.attributeValues) {
    if (pv.attribute.variantMode !== "NONE") continue;
    const key = pv.attribute.name;
    const value = formatValue(pv);
    if (!value) continue;
    map.set(key, map.has(key) ? `${map.get(key)}, ${value}` : value);
  }
  for (const ov of row.variante.product.variantOptionValues) {
    if (ov.attribute.variantMode !== "MULTI_VALUE") continue;
    const key = ov.attribute.name;
    map.set(key, map.has(key) ? `${map.get(key)}, ${ov.value}` : ov.value);
  }
  for (const o of row.variante.options) {
    const key = o.optionValue.attribute.name;
    map.set(key, o.optionValue.value);
  }
  return map;
}

/** Excel no admite "/", "\", "?", "*", "[", "]", ":" en nombres de hoja, ni más de 31 caracteres —
 * se usa "／" (slash de ancho completo) en vez de "/" para mantener el formato pedido "Cat/Subcat"
 * de forma legible. */
function sheetName(rootName: string, subName: string, used: Set<string>): string {
  const base = `${rootName}／${subName}`.replace(/[\\?*[\]:]/g, "-").slice(0, 31);
  let name = base;
  let suffix = 2;
  while (used.has(name)) {
    const cut = base.slice(0, 31 - String(suffix).length - 1);
    name = `${cut}~${suffix}`;
    suffix++;
  }
  used.add(name);
  return name;
}

@Injectable()
export class StockExportService {
  constructor(private readonly prisma: PrismaService) {}

  private fetchRows(): Promise<ExportRow[]> {
    return this.prisma.stock.findMany({
      where: { cantidadFisica: { gt: 0 } },
      orderBy: [{ variante: { product: { brand: { name: "asc" } } } }, { variante: { product: { name: "asc" } } }],
      include: exportInclude,
    });
  }

  /** Excel con una hoja por SUBcategoría (nombre "Categoría／Subcategoría"), todas las existencias con
   * stock físico > 0 en cualquier almacén, sin filtrar por almacén. Una columna por cada atributo
   * definido para esa subcategoría (propio o heredado de su categoría raíz), vacía si el producto no
   * tiene valor cargado para ese atributo. */
  async buildExport(): Promise<Buffer> {
    const rows = await this.fetchRows();

    const porSubcategoria = new Map<string, { rootName: string; subName: string; rows: ExportRow[] }>();
    for (const row of rows) {
      const category = row.variante.product.category;
      const subId = category?.id ?? "sin-categoria";
      const subName = category?.name ?? "Sin categoría";
      const grupo = porSubcategoria.get(subId);
      if (grupo) grupo.rows.push(row);
      else porSubcategoria.set(subId, { rootName: "", subName, rows: [row] });
    }

    // rootName se resuelve aparte porque category.parent no viene en el include (para no duplicar la
    // misma info en cada fila) — se busca una sola vez por cada subcategoría con datos.
    const rootIdBySub = new Map<string, string | null>();
    for (const row of rows) {
      const category = row.variante.product.category;
      if (category && !rootIdBySub.has(category.id)) rootIdBySub.set(category.id, category.parentId);
    }
    const rootIds = Array.from(new Set(Array.from(rootIdBySub.values()).filter((id): id is string => id !== null)));
    const roots = rootIds.length > 0 ? await this.prisma.category.findMany({ where: { id: { in: rootIds } }, select: { id: true, name: true } }) : [];
    const rootNameById = new Map(roots.map((r) => [r.id, r.name]));
    for (const [subId, grupo] of porSubcategoria) {
      const rootId = rootIdBySub.get(subId);
      grupo.rootName = rootId ? (rootNameById.get(rootId) ?? "") : "";
    }

    // Atributos definidos para cada subcategoría: propios + heredados de su raíz, unificados por
    // nombre (mismo criterio que la tabla de Productos) para que dos Attribute con el mismo nombre en
    // subcategoría/raíz no dupliquen columna.
    const attributeColumnsBySub = new Map<string, string[]>();
    for (const subId of porSubcategoria.keys()) {
      const rootId = rootIdBySub.get(subId);
      const categoryIds = rootId ? [subId, rootId] : [subId];
      const attributes = await this.prisma.attribute.findMany({
        where: { categoryId: { in: categoryIds } },
        select: { name: true, orden: true },
        orderBy: { orden: "asc" },
      });
      const seen = new Map<string, number>();
      for (const attr of attributes) {
        if (!seen.has(attr.name)) seen.set(attr.name, attr.orden);
      }
      attributeColumnsBySub.set(
        subId,
        Array.from(seen.entries())
          .sort((a, b) => a[1] - b[1])
          .map(([name]) => name),
      );
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Ethereal Scents";
    wb.created = new Date();

    const usedSheetNames = new Set<string>();
    const entries = Array.from(porSubcategoria.entries()).sort((a, b) => {
      const rootCmp = a[1].rootName.localeCompare(b[1].rootName);
      return rootCmp !== 0 ? rootCmp : a[1].subName.localeCompare(b[1].subName);
    });

    for (const [subId, grupo] of entries) {
      const attributeNames = attributeColumnsBySub.get(subId) ?? [];
      const sheet = wb.addWorksheet(sheetName(grupo.rootName, grupo.subName, usedSheetNames));
      sheet.columns = [
        { header: "Almacén", key: "almacen", width: 20 },
        { header: "Marca", key: "marca", width: 22 },
        { header: "Producto", key: "producto", width: 32 },
        ...attributeNames.map((name, i) => ({ header: name, key: `attr${i}`, width: 18 })),
        { header: "Stock físico", key: "fisica", width: 12 },
        { header: "Stock reservado", key: "reservada", width: 14 },
        { header: "Disponible", key: "disponible", width: 12 },
        { header: "Código producto", key: "codigo", width: 16 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
      sheet.views = [{ state: "frozen", ySplit: 1 }];

      for (const row of grupo.rows) {
        const disponible = row.cantidadFisica - row.cantidadReservada;
        const esMl = row.variante.unidad === "ML";
        const valores = buildAttributeValueMap(row);
        const record: Record<string, string | number> = {
          almacen: row.almacen.nombre,
          marca: row.variante.product.brand?.name ?? "—",
          producto: row.variante.product.name,
          fisica: esMl ? `${row.cantidadFisica} ml` : row.cantidadFisica,
          reservada: esMl ? `${row.cantidadReservada} ml` : row.cantidadReservada,
          disponible: esMl ? `${disponible} ml` : disponible,
          codigo: row.variante.variantCode || row.variante.product.productCode,
        };
        attributeNames.forEach((name, i) => {
          record[`attr${i}`] = valores.get(name) ?? "";
        });
        sheet.addRow(record);
      }
    }

    if (wb.worksheets.length === 0) {
      const sheet = wb.addWorksheet("Existencias");
      sheet.addRow(["Sin existencias con stock físico mayor a 0."]);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
