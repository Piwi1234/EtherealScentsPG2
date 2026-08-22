import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { AttributeVariantMode, Prisma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { generateUniqueEntityCode } from "../entity-code";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E6F7" } };
const SHEET_SIMPLE = "Productos simples";
const SHEET_VARIANTS = "Productos con variantes";

export interface ProductImportRowError {
  sheet: string;
  row: number;
  message: string;
}

export interface ProductImportReport {
  createdSimple: number;
  createdWithVariants: number;
  createdVariants: number;
  errors: ProductImportRowError[];
}

type CategoryRow = { id: string; name: string; parentId: string | null };
type AttributeRow = { id: string; categoryId: string; name: string; variantMode: AttributeVariantMode; isRequired: boolean };
type BrandRow = { id: string; name: string };

type CategoryMeta = {
  id: string;
  name: string;
  pricedVariantAttr: { id: string; name: string } | null;
  hasMultiplePricedVariantAttrs: boolean;
  hasRequiredOtherAttr: boolean;
};

type SimpleOp = {
  name: string;
  categoryId: string;
  brandId: string | null;
  purchasePrice: number;
  utility: number;
  minPriceBs: number | null;
  discountBs: number;
};

type VariantRow = { variante: string; compra: number; utilidad: number; minBs: number | null; descuento: number };
type VariantGroup = {
  firstRow: number;
  name: string;
  categoryId: string;
  variantAttributeId: string;
  brandId: string | null;
  rows: VariantRow[];
};

@Injectable()
export class ProductImportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Plantilla .xlsx en vivo: instrucciones + 2 hojas a llenar + referencia de categorías/marcas actuales. */
  async buildTemplate(): Promise<Buffer> {
    const [categoryRows, brands, attributeRows] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true, parentId: true }, orderBy: { name: "asc" } }),
      this.prisma.brand.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      this.prisma.attribute.findMany({
        select: { id: true, categoryId: true, name: true, variantMode: true, isRequired: true },
        orderBy: { orden: "asc" },
      }),
    ]);
    const metaById = buildCategoryMeta(categoryRows, attributeRows);
    const catById = new Map(categoryRows.map((c) => [c.id, c]));
    const categoryInfo = categoryRows
      .map((c) => {
        const meta = metaById.get(c.id)!;
        return {
          id: c.id,
          name: c.name,
          tipo: c.parentId ? "Subcategoría" : "Raíz",
          padre: c.parentId ? catById.get(c.parentId)?.name ?? "" : "",
          hasPricedVariants: Boolean(meta.pricedVariantAttr) || meta.hasMultiplePricedVariantAttrs,
          variantAttrName: meta.pricedVariantAttr?.name ?? (meta.hasMultiplePricedVariantAttrs ? "(más de uno — no soportado)" : ""),
          blockedByRequired: meta.hasRequiredOtherAttr,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const simpleCategories = categoryInfo.filter((c) => !c.hasPricedVariants);
    const variantCategories = categoryInfo.filter((c) => c.hasPricedVariants);

    const wb = new ExcelJS.Workbook();
    wb.creator = "Ethereal Scents";
    wb.created = new Date();

    const info = wb.addWorksheet("Instrucciones");
    info.columns = [{ width: 26 }, { width: 100 }];
    const title = info.addRow(["Plantilla de importación de Productos", ""]);
    title.font = { bold: true, size: 14 };
    info.addRow([]);
    const sub1 = info.addRow(["Hay 2 hojas de datos, según el tipo de producto:", ""]);
    sub1.font = { bold: true };
    info.addRow(["", `"${SHEET_SIMPLE}": categorías SIN variantes con precio propio. Una fila = un producto.`]);
    info.addRow([
      "",
      `"${SHEET_VARIANTS}": categorías CON variante con precio propio (ej. Perfumes → Tamaño). Una fila = una variante; varias filas con el mismo "Producto" arman el mismo producto con varias opciones.`,
    ]);
    info.addRow([]);
    const headerRow = info.addRow(["Columna", "Regla"]);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => (cell.fill = HEADER_FILL));
    const rules: [string, string][] = [
      ["Nombre / Producto", 'Obligatorio. En la hoja de variantes, repetir el mismo nombre en cada fila de ese producto.'],
      ["Categoría", 'Obligatorio. Nombre EXACTO de una categoría (ver hoja "Categorías") — tiene que coincidir con la hoja usada.'],
      ["Marca", 'Opcional. Nombre exacto de una marca (ver hoja "Marcas"). Vacío = sin marca.'],
      ["Variante", 'Solo en la hoja de variantes. Texto libre (ej. "50ml", "GRAPE") — no repetible dentro del mismo producto.'],
      ["Precio de Compra (USD)", "Obligatorio y mayor a 0 (por producto en la hoja simple, por variante en la de variantes)."],
      ["Utilidad (USD)", "Opcional, default 0."],
      ["Precio Min Bs", "Opcional."],
      ["Descuento Bs", "Opcional, default 0."],
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
      "- Borrá las filas de ejemplo (en gris cursiva) antes de importar, o se van a crear como productos reales.",
      "- Esta planilla NO carga atributos comunes (ej. Género, Acordes) ni la imagen del producto — se completan a mano desde el Dashboard después de importar.",
      "- Categorías con un atributo obligatorio (aparte del de variante) quedan bloqueadas para esta planilla — hay que crear esos productos desde el Dashboard.",
      "- No hay upsert por nombre: cada fila válida SIEMPRE crea un producto nuevo (a diferencia de Marcas). Importar el mismo archivo dos veces duplica los productos.",
      "- La importación es todo o nada: si una fila tiene un error, no se crea ningún producto hasta que lo corrijas y vuelvas a subir el archivo.",
    ];
    for (const note of notes) {
      const row = info.addRow([note]);
      info.mergeCells(`A${row.number}:B${row.number}`);
      row.getCell(1).alignment = { wrapText: true };
    }

    const simple = wb.addWorksheet(SHEET_SIMPLE);
    simple.columns = [
      { header: "Nombre", key: "nombre", width: 30 },
      { header: "Categoría", key: "categoria", width: 22 },
      { header: "Marca", key: "marca", width: 18 },
      { header: "Precio de Compra (USD)", key: "compra", width: 20 },
      { header: "Utilidad (USD)", key: "utilidad", width: 16 },
      { header: "Precio Min Bs", key: "minBs", width: 16 },
      { header: "Descuento Bs", key: "descuento", width: 16 },
    ];
    simple.getRow(1).font = { bold: true };
    simple.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    simple.views = [{ state: "frozen", ySplit: 1 }];
    const simpleExample = simpleCategories.find((c) => !c.blockedByRequired);
    if (simpleExample) {
      const exRow = simple.addRow({
        nombre: "Producto de ejemplo",
        categoria: simpleExample.name,
        marca: brands[0]?.name ?? "",
        compra: 8,
        utilidad: 2,
        minBs: "",
        descuento: 0,
      });
      exRow.font = { italic: true, color: { argb: "FF888888" } };
    }
    for (let i = 0; i < 30; i++) simple.addRow({});
    addListValidation(
      simple,
      "B",
      simpleCategories.map((c) => c.name),
      "Categoría inválida",
      "Tiene que ser el nombre exacto de una categoría SIN variantes con precio propio (ver hoja Categorías).",
    );
    addListValidation(simple, "C", brands.map((b) => b.name), "Marca inválida", "Tiene que ser el nombre exacto de una marca existente (ver hoja Marcas), o quedar vacío.");

    const withVariants = wb.addWorksheet(SHEET_VARIANTS);
    withVariants.columns = [
      { header: "Producto", key: "producto", width: 30 },
      { header: "Categoría", key: "categoria", width: 22 },
      { header: "Marca", key: "marca", width: 18 },
      { header: "Variante", key: "variante", width: 18 },
      { header: "Precio de Compra (USD)", key: "compra", width: 20 },
      { header: "Utilidad (USD)", key: "utilidad", width: 16 },
      { header: "Precio Min Bs", key: "minBs", width: 16 },
      { header: "Descuento Bs", key: "descuento", width: 16 },
    ];
    withVariants.getRow(1).font = { bold: true };
    withVariants.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    withVariants.views = [{ state: "frozen", ySplit: 1 }];
    const variantExample = variantCategories.find((c) => !c.blockedByRequired && !c.variantAttrName.startsWith("("));
    if (variantExample) {
      const exampleRows = [
        { producto: "Producto de ejemplo", categoria: variantExample.name, marca: brands[0]?.name ?? "", variante: "Opción A", compra: 25, utilidad: 8, minBs: "", descuento: 0 },
        { producto: "Producto de ejemplo", categoria: variantExample.name, marca: brands[0]?.name ?? "", variante: "Opción B", compra: 42, utilidad: 12, minBs: "", descuento: 0 },
      ];
      for (const row of exampleRows) {
        const r = withVariants.addRow(row);
        r.font = { italic: true, color: { argb: "FF888888" } };
      }
    }
    for (let i = 0; i < 30; i++) withVariants.addRow({});
    addListValidation(
      withVariants,
      "B",
      variantCategories.map((c) => c.name),
      "Categoría inválida",
      "Tiene que ser el nombre exacto de una categoría CON variante con precio propio (ver hoja Categorías).",
    );
    addListValidation(withVariants, "C", brands.map((b) => b.name), "Marca inválida", "Tiene que ser el nombre exacto de una marca existente (ver hoja Marcas), o quedar vacío.");

    const catSheet = wb.addWorksheet("Categorías");
    catSheet.columns = [
      { header: "Nombre", key: "nombre", width: 22 },
      { header: "Tipo", key: "tipo", width: 14 },
      { header: "Categoría Padre", key: "padre", width: 18 },
      { header: "¿Variantes con precio propio?", key: "variantes", width: 26 },
      { header: "Atributo de variante", key: "attrVariante", width: 22 },
      { header: "¿Bloqueada por atributo obligatorio?", key: "bloqueada", width: 30 },
    ];
    catSheet.getRow(1).font = { bold: true };
    catSheet.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    for (const c of categoryInfo) {
      catSheet.addRow({
        nombre: c.name,
        tipo: c.tipo,
        padre: c.padre,
        variantes: c.hasPricedVariants ? "Sí" : "No",
        attrVariante: c.variantAttrName,
        bloqueada: c.blockedByRequired ? "Sí — no se puede usar esta planilla" : "No",
      });
    }

    const brandSheet = wb.addWorksheet("Marcas");
    brandSheet.columns = [{ header: "Nombre", key: "nombre", width: 26 }];
    brandSheet.getRow(1).font = { bold: true };
    brandSheet.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    for (const b of brands) brandSheet.addRow({ nombre: b.name });

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * Todo o nada: primero valida todas las filas de ambas hojas (sin tocar la base), y solo si no hay
   * ningún error crea los productos en una sola transacción. Sin upsert: cada fila válida crea un
   * producto nuevo.
   */
  async importFromFile(buffer: Buffer): Promise<ProductImportReport> {
    const wb = new ExcelJS.Workbook();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException("No se pudo leer el archivo — tiene que ser un Excel (.xlsx) válido.");
    }
    const simpleSheet = wb.getWorksheet(SHEET_SIMPLE);
    const variantsSheet = wb.getWorksheet(SHEET_VARIANTS);
    if (!simpleSheet || !variantsSheet) {
      throw new BadRequestException(`El archivo tiene que tener las hojas "${SHEET_SIMPLE}" y "${SHEET_VARIANTS}".`);
    }

    const [categoryRows, brandRows, attributeRows] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
      this.prisma.brand.findMany({ select: { id: true, name: true } }),
      this.prisma.attribute.findMany({ select: { id: true, categoryId: true, name: true, variantMode: true, isRequired: true } }),
    ]);
    const metaById = buildCategoryMeta(categoryRows, attributeRows);
    const categoryByName = new Map<string, CategoryMeta>(
      categoryRows.map((c) => [c.name.trim().toLowerCase(), metaById.get(c.id)!]),
    );
    const brandByName = new Map<string, BrandRow>(brandRows.map((b) => [b.name.trim().toLowerCase(), b]));

    const errors: ProductImportRowError[] = [];
    const simpleOps: SimpleOp[] = [];
    const variantGroups = new Map<string, VariantGroup>();

    simpleSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const name = cellText(row.getCell(1).value);
      if (!name) return;

      const categoriaName = cellText(row.getCell(2).value);
      const marcaName = cellText(row.getCell(3).value);
      const compra = cellNumber(row.getCell(4).value);
      const utilidad = cellNumber(row.getCell(5).value);
      const minBs = cellNumber(row.getCell(6).value);
      const descuento = cellNumber(row.getCell(7).value);

      let hasError = false;
      const fail = (message: string) => {
        errors.push({ sheet: SHEET_SIMPLE, row: rowNumber, message });
        hasError = true;
      };

      let category: CategoryMeta | undefined;
      if (!categoriaName) {
        fail("Categoría es obligatoria.");
      } else {
        category = categoryByName.get(categoriaName.toLowerCase());
        if (!category) fail(`Categoría "${categoriaName}" no existe.`);
        else if (category.pricedVariantAttr || category.hasMultiplePricedVariantAttrs) {
          fail(`Categoría "${categoriaName}" tiene variante con precio propio — usá la hoja "${SHEET_VARIANTS}".`);
        } else if (category.hasRequiredOtherAttr) {
          fail(`Categoría "${categoriaName}" tiene un atributo obligatorio que esta planilla no carga — creá el producto desde el Dashboard.`);
        }
      }

      let brandId: string | null = null;
      if (marcaName) {
        const brand = brandByName.get(marcaName.toLowerCase());
        if (!brand) fail(`Marca "${marcaName}" no existe.`);
        else brandId = brand.id;
      }

      if (compra === null) fail("Precio de Compra (USD) es obligatorio.");
      else if (Number.isNaN(compra) || compra <= 0) fail("Precio de Compra (USD) inválido — tiene que ser mayor a 0.");
      if (utilidad !== null && Number.isNaN(utilidad)) fail("Utilidad (USD) inválida.");
      if (minBs !== null && Number.isNaN(minBs)) fail("Precio Min Bs inválido.");
      if (descuento !== null && Number.isNaN(descuento)) fail("Descuento Bs inválido.");

      if (!hasError && category) {
        simpleOps.push({
          name,
          categoryId: category.id,
          brandId,
          purchasePrice: compra as number,
          utility: utilidad ?? 0,
          minPriceBs: minBs,
          discountBs: descuento ?? 0,
        });
      }
    });

    variantsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const name = cellText(row.getCell(1).value);
      if (!name) return;

      const categoriaName = cellText(row.getCell(2).value);
      const marcaName = cellText(row.getCell(3).value);
      const variante = cellText(row.getCell(4).value);
      const compra = cellNumber(row.getCell(5).value);
      const utilidad = cellNumber(row.getCell(6).value);
      const minBs = cellNumber(row.getCell(7).value);
      const descuento = cellNumber(row.getCell(8).value);

      let hasError = false;
      const fail = (message: string) => {
        errors.push({ sheet: SHEET_VARIANTS, row: rowNumber, message });
        hasError = true;
      };

      let category: CategoryMeta | undefined;
      if (!categoriaName) {
        fail("Categoría es obligatoria.");
      } else {
        category = categoryByName.get(categoriaName.toLowerCase());
        if (!category) fail(`Categoría "${categoriaName}" no existe.`);
        else if (!category.pricedVariantAttr) {
          if (category.hasMultiplePricedVariantAttrs) {
            fail(`Categoría "${categoriaName}" tiene más de un atributo con precio propio — esta planilla no lo soporta, creá el producto desde el Dashboard.`);
          } else {
            fail(`Categoría "${categoriaName}" no tiene variante con precio propio — usá la hoja "${SHEET_SIMPLE}".`);
          }
        } else if (category.hasRequiredOtherAttr) {
          fail(`Categoría "${categoriaName}" tiene un atributo obligatorio que esta planilla no carga — creá el producto desde el Dashboard.`);
        }
      }

      let brandId: string | null = null;
      if (marcaName) {
        const brand = brandByName.get(marcaName.toLowerCase());
        if (!brand) fail(`Marca "${marcaName}" no existe.`);
        else brandId = brand.id;
      }

      if (!variante) fail("Variante es obligatoria.");
      if (compra === null) fail("Precio de Compra (USD) es obligatorio.");
      else if (Number.isNaN(compra) || compra <= 0) fail("Precio de Compra (USD) inválido — tiene que ser mayor a 0.");
      if (utilidad !== null && Number.isNaN(utilidad)) fail("Utilidad (USD) inválida.");
      if (minBs !== null && Number.isNaN(minBs)) fail("Precio Min Bs inválido.");
      if (descuento !== null && Number.isNaN(descuento)) fail("Descuento Bs inválido.");

      if (hasError || !category || !category.pricedVariantAttr) return;

      const key = `${name.toLowerCase()}|${category.id}`;
      let group = variantGroups.get(key);
      if (!group) {
        group = { firstRow: rowNumber, name, categoryId: category.id, variantAttributeId: category.pricedVariantAttr.id, brandId, rows: [] };
        variantGroups.set(key, group);
      } else if (group.brandId !== brandId) {
        errors.push({
          sheet: SHEET_VARIANTS,
          row: rowNumber,
          message: `La marca no coincide con la fila ${group.firstRow} del mismo producto "${name}".`,
        });
        return;
      }
      if (group.rows.some((r) => r.variante.toLowerCase() === variante.toLowerCase())) {
        errors.push({ sheet: SHEET_VARIANTS, row: rowNumber, message: `Variante "${variante}" repetida para el producto "${name}".` });
        return;
      }
      group.rows.push({ variante, compra: compra as number, utilidad: utilidad ?? 0, minBs, descuento: descuento ?? 0 });
    });

    if (errors.length > 0) {
      errors.sort((a, b) => a.row - b.row);
      return { createdSimple: 0, createdWithVariants: 0, createdVariants: 0, errors };
    }

    let createdSimple = 0;
    let createdWithVariants = 0;
    let createdVariants = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const op of simpleOps) {
        const productCode = await generateProductCode(tx);
        const product = await tx.product.create({
          data: {
            name: op.name,
            productCode,
            purchasePrice: op.purchasePrice,
            utility: op.utility,
            minPriceBs: op.minPriceBs,
            discountBs: op.discountBs,
            brandId: op.brandId,
            categoryId: op.categoryId,
          },
        });
        const variantCode = await generateVariantCode(tx);
        await tx.productVariant.create({
          data: {
            productId: product.id,
            variantCode,
            purchasePrice: op.purchasePrice,
            utility: op.utility,
            minPriceBs: op.minPriceBs,
            discountBs: op.discountBs,
            isDefault: true,
          },
        });
        createdSimple++;
      }

      for (const group of variantGroups.values()) {
        const productCode = await generateProductCode(tx);
        const product = await tx.product.create({
          data: {
            name: group.name,
            productCode,
            purchasePrice: 0,
            utility: 0,
            minPriceBs: null,
            discountBs: 0,
            brandId: group.brandId,
            categoryId: group.categoryId,
          },
        });
        for (const vr of group.rows) {
          const optionValue = await tx.productVariantOptionValue.create({
            data: { productId: product.id, attributeId: group.variantAttributeId, value: vr.variante },
          });
          const variantCode = await generateVariantCode(tx);
          await tx.productVariant.create({
            data: {
              productId: product.id,
              variantCode,
              purchasePrice: vr.compra,
              utility: vr.utilidad,
              minPriceBs: vr.minBs,
              discountBs: vr.descuento,
              options: { create: [{ optionValueId: optionValue.id }] },
            },
          });
          createdVariants++;
        }
        createdWithVariants++;
      }
    });

    return { createdSimple, createdWithVariants, createdVariants, errors: [] };
  }
}

function generateProductCode(tx: Prisma.TransactionClient) {
  return generateUniqueEntityCode(async (code) => Boolean(await tx.product.findUnique({ where: { productCode: code }, select: { id: true } })));
}

function generateVariantCode(tx: Prisma.TransactionClient) {
  return generateUniqueEntityCode(async (code) => Boolean(await tx.productVariant.findUnique({ where: { variantCode: code }, select: { id: true } })));
}

function buildCategoryMeta(categories: CategoryRow[], attributes: AttributeRow[]): Map<string, CategoryMeta> {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const attrsByCategory = new Map<string, AttributeRow[]>();
  for (const attribute of attributes) {
    const list = attrsByCategory.get(attribute.categoryId) ?? [];
    list.push(attribute);
    attrsByCategory.set(attribute.categoryId, list);
  }

  function ancestorIds(categoryId: string): string[] {
    const chain: string[] = [];
    let current: CategoryRow | undefined = catById.get(categoryId);
    while (current) {
      chain.push(current.id);
      current = current.parentId ? catById.get(current.parentId) : undefined;
    }
    return chain;
  }

  const result = new Map<string, CategoryMeta>();
  for (const category of categories) {
    const chain = ancestorIds(category.id);
    const effective = chain.flatMap((id) => attrsByCategory.get(id) ?? []);
    const priced = effective.filter((a) => a.variantMode === AttributeVariantMode.PRICED_VARIANT);
    const hasRequiredOther = effective.some((a) => a.variantMode === AttributeVariantMode.NONE && a.isRequired);
    result.set(category.id, {
      id: category.id,
      name: category.name,
      pricedVariantAttr: priced.length === 1 ? { id: priced[0].id, name: priced[0].name } : null,
      hasMultiplePricedVariantAttrs: priced.length > 1,
      hasRequiredOtherAttr: hasRequiredOther,
    });
  }
  return result;
}

function addListValidation(sheet: ExcelJS.Worksheet, column: string, values: string[], errorTitle: string, error: string) {
  if (values.length === 0) return;
  const formula = `"${values.join(",")}"`;
  for (let r = 2; r <= 200; r++) {
    sheet.getCell(`${column}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorTitle,
      error,
    };
  }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text).trim();
  return String(value).trim();
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  const text = cellText(value);
  if (!text) return null;
  const n = Number(text.replace(",", "."));
  return n;
}
