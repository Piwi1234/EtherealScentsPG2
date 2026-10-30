import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { AttributeVariantMode, Prisma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { SettingsService } from "../../settings/settings.service";
import { computeBsPrices, computeCatalogPrice } from "../../catalog/product-price";
import { transitoCompras } from "./transito-compras.util";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E6F7" } };

const varianteProductInclude = {
  select: {
    name: true,
    productCode: true,
    brand: { select: { name: true } },
    category: {
      select: { id: true, name: true, parentId: true, logisticsCost: true, shippingCost: true, securityCost: true },
    },
    attributeValues: { include: { attribute: true, option: true } },
    variantOptionValues: { include: { attribute: true } },
  },
} as const;

const stockInclude = {
  variante: {
    select: {
      id: true,
      unidad: true,
      purchasePrice: true,
      utility: true,
      minPriceBs: true,
      discountBs: true,
      product: varianteProductInclude,
      options: { include: { optionValue: { include: { attribute: true } } } },
      // Decants (unidad ML): lo que se vende de esos ml, con su precio.
      presentaciones: { where: { activo: true }, orderBy: { cantidadMl: "asc" }, select: { cantidadMl: true, precioVentaBs: true } },
    },
  },
  almacen: { select: { nombre: true } },
} as const;

const loteInclude = {
  variante: {
    select: {
      unidad: true,
      product: varianteProductInclude,
      options: { include: { optionValue: { include: { attribute: true } } } },
    },
  },
  almacen: { select: { nombre: true } },
  proformaDetalle: { select: { proforma: { select: { codigo: true, fecha: true, tipoCambioProf: true } } } },
} as const;

type StockRow = Prisma.StockGetPayload<{ include: typeof stockInclude }>;
type LoteRow = Prisma.LoteCompraGetPayload<{ include: typeof loteInclude }>;
type VarianteRow = StockRow["variante"] | LoteRow["variante"];

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

/** Junta las 3 fuentes de valor de atributo de una variante. Clave por NOMBRE de atributo, no por id,
 * para que dos Attribute distintos (subcategoría + raíz) con el mismo nombre caigan en la misma
 * columna — mismo criterio que "unificar columnas por nombre" en Productos. */
function buildAttributeValueMap(variante: VarianteRow): Map<string, string> {
  const map = new Map<string, string>();
  for (const pv of variante.product.attributeValues) {
    if (pv.attribute.variantMode !== "NONE") continue;
    const key = pv.attribute.name;
    const value = formatValue(pv);
    if (!value) continue;
    map.set(key, map.has(key) ? `${map.get(key)}, ${value}` : value);
  }
  for (const ov of variante.product.variantOptionValues) {
    if (ov.attribute.variantMode !== "MULTI_VALUE") continue;
    const key = ov.attribute.name;
    map.set(key, map.has(key) ? `${map.get(key)}, ${ov.value}` : ov.value);
  }
  for (const o of variante.options) {
    map.set(o.optionValue.attribute.name, o.optionValue.value);
  }
  return map;
}

/** Excel no admite "/", "\", "?", "*", "[", "]", ":" en nombres de hoja, ni más de 31 caracteres —
 * se usa "／" (slash de ancho completo) en vez de "/" para mantener el formato "Cat/Subcat" legible. */
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

function formatDate(value: Date): string {
  return value.toLocaleDateString("es-VE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

type ExtraColumn = {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
  /** La columna solo sale en las hojas donde algún renglón tiene valor (ej. presentaciones, solo en hojas con decants). */
  soloSiHayValor?: boolean;
};
type ExportEntry = {
  variante: VarianteRow;
  almacen: string;
  /** Valores de las columnas extra de cada export (precio, lote, stock...), por `key`. */
  extras: Record<string, string | number | null>;
};

@Injectable()
export class StockExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** Existencias: Almacén, Marca, Producto, atributos de tarjeta, Precio final Bs, Disponible y Disponible en tránsito.
   * Disponible = físico − reservado; Disponible en tránsito = lo que viaja y todavía no está apartado ni ligado a una nota
   * (ver transito-compras.util.ts). Solo los productos con algo disponible (en el almacén o viajando), sin filtrar por almacén. */
  async buildExistenciasExport(): Promise<Buffer> {
    const [stockRows, transito, exchangeRate] = await Promise.all([
      this.prisma.stock.findMany({
        where: { OR: [{ cantidadFisica: { gt: 0 } }, { cantidadEnTransito: { gt: 0 } }, { cantidadReservadaTransito: { gt: 0 } }] },
        orderBy: [{ variante: { product: { brand: { name: "asc" } } } }, { variante: { product: { name: "asc" } } }],
        include: stockInclude,
      }),
      transitoCompras(this.prisma, {}),
      this.settings.getExchangeRate(),
    ]);

    // Pares (variante, almacén) que solo existen por lo que viaja: no tienen fila de stock todavía.
    const clave = (varianteId: string, almacenId: string) => `${varianteId}|${almacenId}`;
    const conFila = new Set(stockRows.map((r) => clave(r.varianteId, r.almacenId)));
    const soloTransito = transito.filter((t) => !conFila.has(clave(t.varianteId, t.almacenId)));
    const [variantesExtra, almacenesExtra] = soloTransito.length
      ? await Promise.all([
          this.prisma.productVariant.findMany({ where: { id: { in: soloTransito.map((t) => t.varianteId) } }, select: stockInclude.variante.select }),
          this.prisma.almacen.findMany({ where: { id: { in: soloTransito.map((t) => t.almacenId) } }, select: { id: true, nombre: true } }),
        ])
      : [[], []];
    const varianteExtraPorId = new Map(variantesExtra.map((v) => [v.id, v]));
    const almacenExtraPorId = new Map(almacenesExtra.map((a) => [a.id, a.nombre]));
    const transitoPorPar = new Map(transito.map((t) => [clave(t.varianteId, t.almacenId), t]));

    const filas: { variante: StockRow["variante"]; almacen: string; disponible: number; disponibleTransito: number }[] = [];
    for (const row of stockRows) {
      const t = transitoPorPar.get(clave(row.varianteId, row.almacenId));
      filas.push({
        variante: row.variante,
        almacen: row.almacen.nombre,
        disponible: row.cantidadFisica - row.cantidadReservada,
        disponibleTransito: Math.max(0, (t?.total ?? 0) - (t?.ligado ?? 0) - row.cantidadReservadaTransito),
      });
    }
    for (const t of soloTransito) {
      const variante = varianteExtraPorId.get(t.varianteId);
      if (!variante) continue;
      filas.push({ variante, almacen: almacenExtraPorId.get(t.almacenId) ?? "—", disponible: 0, disponibleTransito: Math.max(0, t.total - t.ligado) });
    }

    const entries: ExportEntry[] = filas
      .filter((f) => f.disponible > 0 || f.disponibleTransito > 0)
      .map((f) => {
        const v = f.variante;
        const priceUsd = computeCatalogPrice(v.purchasePrice, v.utility, v.product.category);
        const { finalPriceBs } = computeBsPrices(priceUsd, v, exchangeRate);
        const cantidad = (n: number) => (v.unidad === "ML" ? `${n} ml` : n);
        const esDecant = v.unidad === "ML";
        return {
          variante: v,
          almacen: f.almacen,
          extras: {
            // Los ml no se venden directo: no tienen precio propio, se venden por las presentaciones de abajo.
            precio: esDecant ? null : finalPriceBs,
            presentaciones: esDecant ? v.presentaciones.map((p) => `${p.cantidadMl} ml: Bs ${Number(p.precioVentaBs).toFixed(2)}`).join(" · ") : null,
            disponible: cantidad(f.disponible),
            disponibleTransito: cantidad(f.disponibleTransito),
          },
        };
      });

    return this.buildWorkbook(
      entries,
      [
        { header: "Precio final Bs", key: "precio", width: 16, numFmt: "#,##0.00" },
        { header: "Presentaciones decants", key: "presentaciones", width: 34, soloSiHayValor: true },
        { header: "Disponible", key: "disponible", width: 13 },
        { header: "Disponible en tránsito", key: "disponibleTransito", width: 22 },
      ],
      "Sin existencias disponibles ni disponibles en tránsito.",
    );
  }

  /** Existencias por lote: Almacén, Marca, Producto, atributos de tarjeta, Lote, Precio compra lote Bs,
   * Stock. Un renglón por lote de compra con unidades disponibles (> 0). El costo del lote se valora en
   * Bs con el tipo de cambio de la compra que lo trajo (no el del sistema). */
  async buildLotesExport(): Promise<Buffer> {
    const lotes = await this.prisma.loteCompra.findMany({
      where: { cantidadDisponible: { gt: 0 } },
      orderBy: [
        { variante: { product: { brand: { name: "asc" } } } },
        { variante: { product: { name: "asc" } } },
        { fecha: "asc" },
      ],
      include: loteInclude,
    });

    const entries: ExportEntry[] = lotes.map((lote) => {
      const proforma = lote.proformaDetalle.proforma;
      const tipoCambio = proforma.tipoCambioProf ? Number(proforma.tipoCambioProf) : null;
      return {
        variante: lote.variante,
        almacen: lote.almacen.nombre,
        extras: {
          lote: `${proforma.codigo} · ${formatDate(lote.fecha)}`,
          precioLote: tipoCambio ? Number(lote.costoUnitario) * tipoCambio : null,
          stock: lote.variante.unidad === "ML" ? `${lote.cantidadDisponible} ml` : lote.cantidadDisponible,
        },
      };
    });

    return this.buildWorkbook(
      entries,
      [
        { header: "Lote", key: "lote", width: 22 },
        { header: "Precio compra lote Bs", key: "precioLote", width: 20, numFmt: "#,##0.00" },
        { header: "Stock", key: "stock", width: 12 },
      ],
      "Sin lotes de compra con unidades disponibles.",
    );
  }

  /** Una hoja por SUBcategoría (nombre "Categoría／Subcategoría"). Columnas fijas Almacén/Marca/
   * Producto, después una por cada atributo marcado "mostrar en tarjeta" (o con precio propio) definido para esa
   * subcategoría (propio o heredado de su raíz, en el orden de la tarjeta), y al final las columnas
   * extra propias de cada export. */
  private async buildWorkbook(entries: ExportEntry[], extraColumns: ExtraColumn[], emptyMessage: string): Promise<Buffer> {
    const porSubcategoria = new Map<string, { rootName: string; subName: string; parentId: string | null; entries: ExportEntry[] }>();
    for (const entry of entries) {
      const category = entry.variante.product.category;
      const subId = category?.id ?? "sin-categoria";
      const grupo = porSubcategoria.get(subId);
      if (grupo) grupo.entries.push(entry);
      else
        porSubcategoria.set(subId, {
          rootName: "",
          subName: category?.name ?? "Sin categoría",
          parentId: category?.parentId ?? null,
          entries: [entry],
        });
    }

    // rootName se resuelve aparte porque category.parent no viene en el include (para no duplicar la
    // misma info en cada fila) — se busca una sola vez por cada subcategoría con datos.
    const rootIds = Array.from(new Set(Array.from(porSubcategoria.values()).map((g) => g.parentId).filter((id): id is string => id !== null)));
    const roots = rootIds.length > 0 ? await this.prisma.category.findMany({ where: { id: { in: rootIds } }, select: { id: true, name: true } }) : [];
    const rootNameById = new Map(roots.map((r) => [r.id, r.name]));
    for (const grupo of porSubcategoria.values()) {
      grupo.rootName = grupo.parentId ? (rootNameById.get(grupo.parentId) ?? "") : "";
    }

    // Atributos de tarjeta de cada subcategoría: propios + heredados de su raíz, unificados por nombre.
    const attributeColumnsBySub = new Map<string, string[]>();
    for (const [subId, grupo] of porSubcategoria) {
      const categoryIds = grupo.parentId ? [subId, grupo.parentId] : [subId];
      const attributes = await this.prisma.attribute.findMany({
        // Los de tarjeta y, siempre, los de precio propio (ej. Sabor en Vapes): cada fila del export es una variante, así que
        // su valor es justo lo que distingue una fila de otra.
        where: { categoryId: { in: categoryIds }, OR: [{ mostrarEnTarjeta: true }, { variantMode: AttributeVariantMode.PRICED_VARIANT }] },
        select: { name: true, ordenTarjeta: true },
        orderBy: { ordenTarjeta: "asc" },
      });
      const seen = new Map<string, number>();
      for (const attr of attributes) {
        if (!seen.has(attr.name)) seen.set(attr.name, attr.ordenTarjeta);
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
    const sorted = Array.from(porSubcategoria.entries()).sort((a, b) => {
      const rootCmp = a[1].rootName.localeCompare(b[1].rootName);
      return rootCmp !== 0 ? rootCmp : a[1].subName.localeCompare(b[1].subName);
    });

    for (const [subId, grupo] of sorted) {
      const attributeNames = attributeColumnsBySub.get(subId) ?? [];
      const sheet = wb.addWorksheet(sheetName(grupo.rootName, grupo.subName, usedSheetNames));
      const extrasDeHoja = extraColumns.filter((c) => !c.soloSiHayValor || grupo.entries.some((e) => e.extras[c.key]));
      sheet.columns = [
        { header: "Almacén", key: "almacen", width: 20 },
        { header: "Marca", key: "marca", width: 22 },
        { header: "Producto", key: "producto", width: 32 },
        ...attributeNames.map((name, i) => ({ header: name, key: `attr${i}`, width: 18 })),
        ...extrasDeHoja.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.numFmt ? { numFmt: c.numFmt } : undefined })),
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
      sheet.views = [{ state: "frozen", ySplit: 1 }];

      for (const entry of grupo.entries) {
        const valores = buildAttributeValueMap(entry.variante);
        const record: Record<string, string | number | null> = {
          almacen: entry.almacen,
          marca: entry.variante.product.brand?.name ?? "—",
          producto: entry.variante.product.name,
          ...entry.extras,
        };
        attributeNames.forEach((name, i) => {
          record[`attr${i}`] = valores.get(name) ?? "";
        });
        sheet.addRow(record);
      }
    }

    if (wb.worksheets.length === 0) {
      const sheet = wb.addWorksheet("Existencias");
      sheet.addRow([emptyMessage]);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
