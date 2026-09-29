import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { AttributeVariantMode } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { AttributeService } from "../attribute/attribute.service";
import { generateUniqueEntityCode } from "../entity-code";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E6F7" } };

export interface ProductVariantImportRowError {
  row: number;
  message: string;
}

export interface ProductVariantImportReport {
  total: number;
  created: number;
  errors: ProductVariantImportRowError[];
}

@Injectable()
export class ProductVariantImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attributes: AttributeService,
  ) {}

  /** Plantilla .xlsx en vivo: instrucciones + hoja a llenar. Sin hoja de referencia de productos a
   * propósito — con miles de productos sería una plantilla enorme; el código se busca en Gestión →
   * Productos (columna "ID Producto" / filtro "ID Producto"). */
  async buildTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Ethereal Scents";
    wb.created = new Date();

    const info = wb.addWorksheet("Instrucciones");
    info.columns = [{ width: 22 }, { width: 100 }];
    const title = info.addRow(["Plantilla de importación de Variantes", ""]);
    title.font = { bold: true, size: 14 };
    info.addRow([]);
    const headerRow = info.addRow(["Columna", "Regla"]);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => (cell.fill = HEADER_FILL));
    const rules: [string, string][] = [
      [
        "Código de producto",
        'Obligatorio. El código de 7 caracteres del producto (columna "ID Producto" en Gestión → ' +
          "Productos). Tiene que ser un producto que ya exista.",
      ],
      ["Tamaño", 'Obligatorio. Texto libre (ej. "50 ml", "100 ml").'],
      ["Precio de Compra ($)", "Obligatorio. Número mayor a 0, en dólares — mismo campo que \"Compra $\" en la tabla de Productos."],
    ];
    for (const [col, rule] of rules) {
      const row = info.addRow([col, rule]);
      row.getCell(1).font = { bold: true };
      row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    }
    info.addRow([]);
    const notesHeader = info.addRow(["Importante", ""]);
    notesHeader.font = { bold: true };
    const notes = [
      "- La categoría del producto tiene que tener YA configurado un atributo \"con precio propio\" " +
        "(ej. Tamaño) en Gestión → Atributos — si no lo tiene, o tiene más de uno, la fila se rechaza.",
      "- Esta planilla solo AGREGA una variante nueva — si el producto ya tiene una con ese mismo " +
        "Tamaño, la fila se rechaza (no pisa el precio de una variante existente).",
      "- Borrá la fila de ejemplo (en gris cursiva) antes de importar, o se va a crear como una variante real.",
      "- La importación es todo o nada: si una fila tiene un error, no se crea ninguna variante hasta " +
        "que lo corrijas y vuelvas a subir el archivo.",
    ];
    for (const note of notes) {
      const row = info.addRow([note]);
      info.mergeCells(`A${row.number}:B${row.number}`);
      row.getCell(1).alignment = { wrapText: true };
    }

    const sheet = wb.addWorksheet("Variantes");
    sheet.columns = [
      { header: "Código de producto", key: "codigo", width: 20 },
      { header: "Tamaño", key: "tamanio", width: 18 },
      { header: "Precio de Compra ($)", key: "precio", width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const exampleRow = sheet.addRow({ codigo: "AB12CD3", tamanio: "50 ml", precio: 25 });
    exampleRow.font = { italic: true, color: { argb: "FF888888" } };
    for (let i = 0; i < 30; i++) sheet.addRow({});

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * Todo o nada: primero valida todas las filas de la hoja "Variantes" (sin tocar la base), y solo
   * si no hay ningún error crea las variantes en una sola transacción. Cada fila arma DOS registros:
   * el valor propio del producto para el atributo con precio propio de su categoría (ej. "50 ml"
   * para Tamaño), y la variante en sí que lo referencia — mismo mecanismo que
   * POST /products/:id/variant-options + POST /products/:id/variants, hecho acá directo contra `tx`
   * para que las 2053 filas de una importación real queden en una sola transacción atómica.
   */
  async importFromFile(buffer: Buffer): Promise<ProductVariantImportReport> {
    const wb = new ExcelJS.Workbook();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException("No se pudo leer el archivo — tiene que ser un Excel (.xlsx) válido.");
    }
    const sheet = wb.getWorksheet("Variantes");
    if (!sheet) {
      throw new BadRequestException('El archivo no tiene una hoja llamada "Variantes".');
    }

    type RawRow = { row: number; codigo: string; tamanio: string; precioRaw: string };
    const rawRows: RawRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const codigo = cellText(row.getCell(1).value);
      const tamanio = cellText(row.getCell(2).value);
      const precioRaw = cellText(row.getCell(3).value);
      if (!codigo && !tamanio && !precioRaw) return;
      rawRows.push({ row: rowNumber, codigo, tamanio, precioRaw });
    });

    const errors: ProductVariantImportRowError[] = [];
    const fail = (row: number, message: string) => errors.push({ row, message });

    // Productos referenciados: se traen todos de una, con lo mínimo necesario para validar.
    const codes = Array.from(new Set(rawRows.map((r) => r.codigo.toUpperCase()).filter(Boolean)));
    const products =
      codes.length > 0
        ? await this.prisma.product.findMany({
            where: { productCode: { in: codes } },
            select: {
              id: true,
              productCode: true,
              categoryId: true,
              variantOptionValues: { select: { attributeId: true, value: true } },
            },
          })
        : [];
    const productByCode = new Map(products.map((p) => [p.productCode.toUpperCase(), p]));

    // Atributo "con precio propio" de cada categoría involucrada — cacheado, varias filas suelen
    // compartir categoría.
    const categoryIds = Array.from(new Set(products.map((p) => p.categoryId)));
    const pricedAttributeByCategory = new Map<string, { id: string; name: string } | null | "multiple">();
    for (const categoryId of categoryIds) {
      const definitions = await this.attributes.listForCategory(categoryId, true);
      const priced = definitions.filter((attr) => attr.variantMode === AttributeVariantMode.PRICED_VARIANT);
      pricedAttributeByCategory.set(categoryId, priced.length === 1 ? priced[0] : priced.length === 0 ? null : "multiple");
    }

    type Op = { row: number; productId: string; attributeId: string; value: string; purchasePrice: number };
    const ops: Op[] = [];
    // Para detectar duplicados dentro de la propia planilla (mismo producto + mismo tamaño dos veces).
    const seenInSheet = new Map<string, number>();

    for (const raw of rawRows) {
      if (!raw.codigo) {
        fail(raw.row, "Falta el Código de producto.");
        continue;
      }
      if (!raw.tamanio) {
        fail(raw.row, "Falta el Tamaño.");
        continue;
      }
      const precio = Number(raw.precioRaw.replace(",", "."));
      if (!raw.precioRaw || Number.isNaN(precio) || precio <= 0) {
        fail(raw.row, `Precio de Compra inválido: "${raw.precioRaw}" — tiene que ser un número mayor a 0.`);
        continue;
      }

      const product = productByCode.get(raw.codigo.toUpperCase());
      if (!product) {
        fail(raw.row, `Código de producto "${raw.codigo}" no existe.`);
        continue;
      }

      const pricedAttribute = pricedAttributeByCategory.get(product.categoryId) ?? null;
      if (pricedAttribute === null) {
        fail(
          raw.row,
          `El producto "${raw.codigo}" no tiene un atributo con precio propio configurado en su categoría — configuralo primero en Gestión → Atributos.`,
        );
        continue;
      }
      if (pricedAttribute === "multiple") {
        fail(
          raw.row,
          `El producto "${raw.codigo}" tiene más de un atributo con precio propio en su categoría — este import no lo soporta, cargalo a mano.`,
        );
        continue;
      }

      const dedupeKey = `${product.id}::${pricedAttribute.id}::${raw.tamanio.trim().toLowerCase()}`;
      if (seenInSheet.has(dedupeKey)) {
        fail(raw.row, `"${raw.codigo}" + Tamaño "${raw.tamanio}" repetido (ya aparece en la fila ${seenInSheet.get(dedupeKey)}).`);
        continue;
      }
      seenInSheet.set(dedupeKey, raw.row);

      const alreadyExists = product.variantOptionValues.some(
        (v) => v.attributeId === pricedAttribute.id && v.value.trim().toLowerCase() === raw.tamanio.trim().toLowerCase(),
      );
      if (alreadyExists) {
        fail(raw.row, `El producto "${raw.codigo}" ya tiene una variante con Tamaño "${raw.tamanio}".`);
        continue;
      }

      ops.push({ row: raw.row, productId: product.id, attributeId: pricedAttribute.id, value: raw.tamanio, purchasePrice: precio });
    }

    if (errors.length > 0) {
      errors.sort((a, b) => a.row - b.row);
      return { total: ops.length + errors.length, created: 0, errors };
    }

    let created = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const op of ops) {
        const optionValue = await tx.productVariantOptionValue.create({
          data: { productId: op.productId, attributeId: op.attributeId, value: op.value },
        });
        const variantCode = await generateUniqueEntityCode(async (code) => {
          const existing = await tx.productVariant.findUnique({ where: { variantCode: code }, select: { id: true } });
          return Boolean(existing);
        });
        await tx.productVariant.create({
          data: {
            productId: op.productId,
            variantCode,
            purchasePrice: op.purchasePrice,
            utility: 0,
            minPriceBs: null,
            discountBs: 0,
            isDefault: false,
            options: { create: [{ optionValueId: optionValue.id }] },
          },
        });
        created++;
      }
    });

    return { total: ops.length, created, errors: [] };
  }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text).trim();
  return String(value).trim();
}
