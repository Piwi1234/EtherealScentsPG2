import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { AttributeVariantMode } from "@app/database";
import { slugify } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { AttributeService } from "../attribute/attribute.service";
import { generateUniqueEntityCode } from "../entity-code";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E6F7" } };

export interface ProductImportRowError {
  row: number;
  message: string;
}

export interface ProductImportReport {
  total: number;
  created: number;
  errors: ProductImportRowError[];
}

type CategoryRow = { id: string; name: string; parentId: string | null };
type BrandRow = { id: string; name: string };

@Injectable()
export class ProductImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attributes: AttributeService,
  ) {}

  /** Plantilla .xlsx en vivo: instrucciones + hoja a llenar + referencia de categorías/marcas actuales. */
  async buildTemplate(): Promise<Buffer> {
    const [categories, brands] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true, parentId: true }, orderBy: { name: "asc" } }),
      this.prisma.brand.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    ]);
    const catById = new Map(categories.map((c) => [c.id, c]));
    const roots = categories.filter((c) => c.parentId === null).sort((a, b) => a.name.localeCompare(b.name));
    const subcategories = categories
      .filter((c) => c.parentId !== null)
      .map((c) => ({ name: c.name, root: catById.get(c.parentId as string)?.name ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const wb = new ExcelJS.Workbook();
    wb.creator = "Ethereal Scents";
    wb.created = new Date();

    const info = wb.addWorksheet("Instrucciones");
    info.columns = [{ width: 22 }, { width: 100 }];
    const title = info.addRow(["Plantilla de importación de Productos", ""]);
    title.font = { bold: true, size: 14 };
    info.addRow([]);
    const headerRow = info.addRow(["Columna", "Regla"]);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => (cell.fill = HEADER_FILL));
    const rules: [string, string][] = [
      ["Categoría", 'Obligatorio. Categoría raíz (ej. "Perfumes"). Nombre EXACTO — ver hoja "Categorías existentes".'],
      [
        "Subcategoría",
        'Obligatorio si esa categoría tiene subcategorías (la mayoría las tiene). Nombre EXACTO. Dejar ' +
          "vacío solo si la categoría elegida no tiene ninguna subcategoría.",
      ],
      ["Marca", 'Opcional. Nombre EXACTO — ver hoja "Marcas existentes". Si se deja vacío, el producto queda sin marca.'],
      ["Nombre", "Obligatorio. Nombre del producto."],
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
      "- Esta planilla solo crea el producto \"en blanco\": queda con precio de compra en $0, sin imagen, " +
        "sin atributos y sin variantes adicionales. Completalo después abriéndolo en Editar, dentro de " +
        "Gestión → Productos.",
      "- Los nombres de producto no tienen que ser únicos: si escribís el mismo nombre dos veces (o ya existe " +
        "uno igual), se crea un producto nuevo cada vez, no se actualiza ni se fusiona con el existente.",
      "- Borrá la fila de ejemplo (en gris cursiva) antes de importar, o se va a crear como un producto real.",
      "- La importación es todo o nada: si una fila tiene un error, no se crea ningún producto hasta que lo " +
        "corrijas y vuelvas a subir el archivo.",
    ];
    for (const note of notes) {
      const row = info.addRow([note]);
      info.mergeCells(`A${row.number}:B${row.number}`);
      row.getCell(1).alignment = { wrapText: true };
    }

    const sheet = wb.addWorksheet("Productos");
    sheet.columns = [
      { header: "Categoría", key: "categoria", width: 22 },
      { header: "Subcategoría", key: "subcategoria", width: 22 },
      { header: "Marca", key: "marca", width: 22 },
      { header: "Nombre", key: "nombre", width: 32 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const exampleSub = subcategories[0];
    const exampleRow = sheet.addRow({
      categoria: exampleSub?.root ?? roots[0]?.name ?? "",
      subcategoria: exampleSub?.name ?? "",
      marca: brands[0]?.name ?? "",
      nombre: "Producto de ejemplo",
    });
    exampleRow.font = { italic: true, color: { argb: "FF888888" } };
    for (let i = 0; i < 30; i++) sheet.addRow({});

    const ref = wb.addWorksheet("Categorías existentes");
    ref.columns = [
      { header: "Categoría", key: "categoria", width: 22 },
      { header: "Subcategoría", key: "subcategoria", width: 26 },
    ];
    ref.getRow(1).font = { bold: true };
    ref.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    const rootsWithoutSubs = roots.filter((root) => !categories.some((c) => c.parentId === root.id));
    for (const root of rootsWithoutSubs) ref.addRow({ categoria: root.name, subcategoria: "(sin subcategorías — dejar vacío)" });
    for (const c of subcategories) ref.addRow({ categoria: c.root, subcategoria: c.name });

    const brandRef = wb.addWorksheet("Marcas existentes");
    brandRef.columns = [{ header: "Nombre", key: "nombre", width: 26 }];
    brandRef.getRow(1).font = { bold: true };
    brandRef.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    for (const b of brands) brandRef.addRow({ nombre: b.name });

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * Todo o nada: primero valida todas las filas de la hoja "Productos" (sin tocar la base), y solo
   * si no hay ningún error crea los productos en una sola transacción. Cada producto se crea "en
   * blanco" (precio de compra $0, sin atributos) — mismo criterio que product.service.ts al crear
   * un producto sin priced-variants: se le suma una variante "default" para que Stock/Proformas
   * tengan un varianteId consistente al que atarse.
   */
  async importFromFile(buffer: Buffer): Promise<ProductImportReport> {
    const wb = new ExcelJS.Workbook();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException("No se pudo leer el archivo — tiene que ser un Excel (.xlsx) válido.");
    }
    const sheet = wb.getWorksheet("Productos");
    if (!sheet) {
      throw new BadRequestException('El archivo no tiene una hoja llamada "Productos".');
    }

    const [categories, existingBrands] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
      this.prisma.brand.findMany({ select: { id: true, name: true } }),
    ]);
    const rootByName = new Map<string, CategoryRow>(
      categories.filter((c) => c.parentId === null).map((c) => [c.name.trim().toLowerCase(), c]),
    );
    const subByRootAndName = new Map<string, CategoryRow>(
      categories
        .filter((c) => c.parentId !== null)
        .map((c) => [`${c.parentId}::${c.name.trim().toLowerCase()}`, c]),
    );
    const rootsWithSubs = new Set(categories.filter((c) => c.parentId !== null).map((c) => c.parentId as string));
    const brandByName = new Map<string, BrandRow>(existingBrands.map((b) => [b.name.trim().toLowerCase(), b]));

    type Op = { row: number; name: string; categoryId: string; brandId: string | null };
    const ops: Op[] = [];
    const errors: ProductImportRowError[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const categoriaRaw = cellText(row.getCell(1).value);
      const subcategoriaRaw = cellText(row.getCell(2).value);
      const marcaRaw = cellText(row.getCell(3).value);
      const nombre = cellText(row.getCell(4).value);
      if (!categoriaRaw && !subcategoriaRaw && !marcaRaw && !nombre) return;

      let hasError = false;
      const fail = (message: string) => {
        errors.push({ row: rowNumber, message });
        hasError = true;
      };

      if (!nombre) fail("Falta el Nombre.");

      let categoryId: string | null = null;
      if (!categoriaRaw) {
        fail("Falta la Categoría.");
      } else {
        const root = rootByName.get(categoriaRaw.toLowerCase());
        if (!root) {
          fail(`Categoría "${categoriaRaw}" no existe.`);
        } else if (rootsWithSubs.has(root.id)) {
          if (!subcategoriaRaw) {
            fail(`Falta la Subcategoría — "${categoriaRaw}" tiene subcategorías.`);
          } else {
            const sub = subByRootAndName.get(`${root.id}::${subcategoriaRaw.toLowerCase()}`);
            if (!sub) {
              fail(`Subcategoría "${subcategoriaRaw}" no existe dentro de "${categoriaRaw}".`);
            } else {
              categoryId = sub.id;
            }
          }
        } else if (subcategoriaRaw) {
          fail(`"${categoriaRaw}" no tiene subcategorías — dejá la columna Subcategoría vacía.`);
        } else {
          categoryId = root.id;
        }
      }

      let brandId: string | null = null;
      if (marcaRaw) {
        const brand = brandByName.get(marcaRaw.toLowerCase());
        if (!brand) {
          fail(`Marca "${marcaRaw}" no existe.`);
        } else {
          brandId = brand.id;
        }
      }

      if (!hasError) {
        ops.push({ row: rowNumber, name: nombre, categoryId: categoryId!, brandId });
      }
    });

    if (errors.length > 0) {
      errors.sort((a, b) => a.row - b.row);
      return { total: ops.length + errors.length, created: 0, errors };
    }

    // Cacheado por categoryId: varios productos de la planilla suelen compartir categoría.
    const hasPricedVariantsCache = new Map<string, boolean>();
    const hasPricedVariants = async (categoryId: string): Promise<boolean> => {
      const cached = hasPricedVariantsCache.get(categoryId);
      if (cached !== undefined) return cached;
      const definitions = await this.attributes.listForCategory(categoryId, true);
      const result = definitions.some((attr) => attr.variantMode === AttributeVariantMode.PRICED_VARIANT);
      hasPricedVariantsCache.set(categoryId, result);
      return result;
    };
    for (const op of ops) {
      await hasPricedVariants(op.categoryId);
    }

    let created = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const op of ops) {
        const productCode = await generateUniqueEntityCode(async (code) => {
          const existing = await tx.product.findUnique({ where: { productCode: code }, select: { id: true } });
          return Boolean(existing);
        });
        const slug = `${slugify(op.name)}-${productCode.toLowerCase()}`;

        const product = await tx.product.create({
          data: {
            name: op.name,
            slug,
            productCode,
            purchasePrice: 0,
            utility: 0,
            minPriceBs: null,
            discountBs: 0,
            brandId: op.brandId,
            categoryId: op.categoryId,
          },
        });

        if (!hasPricedVariantsCache.get(op.categoryId)) {
          const variantCode = await generateUniqueEntityCode(async (code) => {
            const existing = await tx.productVariant.findUnique({ where: { variantCode: code }, select: { id: true } });
            return Boolean(existing);
          });
          await tx.productVariant.create({
            data: {
              productId: product.id,
              variantCode,
              purchasePrice: 0,
              utility: 0,
              minPriceBs: null,
              discountBs: 0,
              isDefault: true,
            },
          });
        }

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
