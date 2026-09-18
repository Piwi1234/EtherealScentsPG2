import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { AttributeType, AttributeVariantMode } from "@app/database";
import { slugify } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { AttributeService } from "../attribute/attribute.service";
import { ProductService, type AttributeValueWrite } from "./product.service";
import type { ProductAttributeValueInputDto } from "./dto/product-attribute-value.dto";
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
    private readonly products: ProductService,
  ) {}

  /** Plantilla .xlsx en vivo: instrucciones + hoja a llenar + referencia de categorías/marcas/atributos actuales. */
  async buildTemplate(): Promise<Buffer> {
    const [categories, brands, attributes] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true, parentId: true }, orderBy: { name: "asc" } }),
      this.prisma.brand.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      // Solo los atributos "normales" (variantMode NONE) son importables por planilla — los que
      // tienen variante propia (MULTI_VALUE/PRICED_VARIANT) se cargan aparte, desde Editar.
      this.prisma.attribute.findMany({
        where: { variantMode: AttributeVariantMode.NONE },
        include: { category: { select: { id: true, name: true, parentId: true } }, options: { orderBy: { value: "asc" } } },
        orderBy: { name: "asc" },
      }),
    ]);
    const catById = new Map(categories.map((c) => [c.id, c]));
    const roots = categories.filter((c) => c.parentId === null).sort((a, b) => a.name.localeCompare(b.name));
    const subcategories = categories
      .filter((c) => c.parentId !== null)
      .map((c) => ({ id: c.id, rootId: c.parentId as string, name: c.name, root: catById.get(c.parentId as string)?.name ?? "" }))
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
      [
        "Atributos",
        "Opcional. Formato \"Nombre=Valor\", separando varios con punto y coma — ej. " +
          '"Genero=Unisex; Concentracion=Eau de Parfum". Nombres y valores EXACTOS — ver hoja "Atributos ' +
          'existentes" (ahí sale, para cada categoría, qué atributos tiene y qué valores acepta cada uno). ' +
          "Un atributo que admite más de un valor puede repetirse: \"Acordes=Citrico; Acordes=Dulce\". Si " +
          "un atributo es obligatorio para esa categoría y no se incluye acá, la fila da error. Los " +
          "atributos con variante propia (los que generan una fila nueva con su propio precio, ej. Tamaño) " +
          "no van acá — esos se siguen cargando aparte, desde Editar.",
      ],
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
      "- Esta planilla crea el producto con precio de compra en $0, sin imagen y sin variantes con precio " +
        "propio (ej. Tamaño) — solo se cargan acá el nombre y, opcionalmente, los atributos sin variante " +
        "(columna Atributos). El resto se completa después abriéndolo en Editar, dentro de Gestión → Productos.",
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
      { header: "Atributos", key: "atributos", width: 45 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const exampleSub = subcategories[0];
    // Incluye tanto los atributos propios de la subcategoría de ejemplo como los heredados de su raíz
    // (ej. Genero/Concentracion suelen definirse en la raíz "Perfumes", no en cada subcategoría).
    const exampleCategoryIds = exampleSub ? [exampleSub.id, exampleSub.rootId] : [roots[0]?.id];
    const exampleAttributeValues = attributes
      .filter((a) => exampleCategoryIds.includes(a.categoryId))
      .slice(0, 2)
      .map((a) => `${a.name}=${a.options[0]?.value ?? "..."}`)
      .join("; ");
    const exampleRow = sheet.addRow({
      categoria: exampleSub?.root ?? roots[0]?.name ?? "",
      subcategoria: exampleSub?.name ?? "",
      marca: brands[0]?.name ?? "",
      nombre: "Producto de ejemplo",
      atributos: exampleAttributeValues,
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

    // Un atributo definido en una categoría raíz aplica también a todas sus subcategorías (herencia
    // — ver attribute.service.ts listForCategory), así que cada fila de acá abajo se repite para cada
    // subcategoría que lo hereda, en vez de listarlo una sola vez a nivel raíz.
    const attrRef = wb.addWorksheet("Atributos existentes");
    attrRef.columns = [
      { header: "Categoría", key: "categoria", width: 22 },
      { header: "Subcategoría", key: "subcategoria", width: 22 },
      { header: "Atributo", key: "atributo", width: 22 },
      { header: "Tipo", key: "tipo", width: 14 },
      { header: "Obligatorio", key: "obligatorio", width: 12 },
      { header: "Valores válidos", key: "valores", width: 45 },
    ];
    attrRef.getRow(1).font = { bold: true };
    attrRef.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    const tipoLabel: Record<string, string> = { TEXT: "Texto libre", NUMBER: "Número", BOOLEAN: "Sí / No", SELECT: "Lista" };
    const addAttrRow = (categoria: string, subcategoria: string, attr: (typeof attributes)[number]) => {
      const valores = attr.type === "SELECT" ? attr.options.map((o) => o.value).join(", ") : "";
      attrRef.addRow({
        categoria,
        subcategoria,
        atributo: attr.name,
        tipo: tipoLabel[attr.type] ?? attr.type,
        obligatorio: attr.isRequired ? "Sí" : "No",
        valores,
      });
    };
    for (const attr of attributes.filter((a) => a.category.parentId === null)) {
      const childSubs = subcategories.filter((s) => s.root === attr.category.name);
      if (childSubs.length === 0) {
        addAttrRow(attr.category.name, "(todas)", attr);
      } else {
        for (const sub of childSubs) addAttrRow(attr.category.name, sub.name, attr);
      }
    }
    for (const attr of attributes.filter((a) => a.category.parentId !== null)) {
      addAttrRow(catById.get(attr.category.parentId as string)?.name ?? "", attr.category.name, attr);
    }

    const brandRef = wb.addWorksheet("Marcas existentes");
    brandRef.columns = [{ header: "Nombre", key: "nombre", width: 26 }];
    brandRef.getRow(1).font = { bold: true };
    brandRef.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    for (const b of brands) brandRef.addRow({ nombre: b.name });

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * Todo o nada: primero valida todas las filas de la hoja "Productos" en dos pasadas (categoría/
   * marca, y recién después — ya con la categoría resuelta — la columna Atributos) sin tocar la
   * base, y solo si no hay ningún error crea los productos en una sola transacción. Cada producto se
   * crea con precio de compra $0 y solo los atributos NONE que haya traído la columna Atributos (los
   * demás campos y los atributos con variante propia se completan después desde Editar) — mismo
   * criterio que product.service.ts al crear un producto sin priced-variants: se le suma una
   * variante "default" para que Stock/Proformas tengan un varianteId consistente al que atarse.
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

    type Op = { row: number; name: string; categoryId: string; brandId: string | null; atributosRaw: string };
    const ops: Op[] = [];
    const errors: ProductImportRowError[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const categoriaRaw = cellText(row.getCell(1).value);
      const subcategoriaRaw = cellText(row.getCell(2).value);
      const marcaRaw = cellText(row.getCell(3).value);
      const nombre = cellText(row.getCell(4).value);
      const atributosRaw = cellText(row.getCell(5).value);
      if (!categoriaRaw && !subcategoriaRaw && !marcaRaw && !nombre && !atributosRaw) return;

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
        ops.push({ row: rowNumber, name: nombre, categoryId: categoryId!, brandId, atributosRaw });
      }
    });

    if (errors.length > 0) {
      errors.sort((a, b) => a.row - b.row);
      return { total: ops.length + errors.length, created: 0, errors };
    }

    // Cacheado por categoryId: varios productos de la planilla suelen compartir categoría. Trae
    // también los atributos propios + heredados (mismo criterio que product.service.ts al crear un
    // producto a mano), para resolver la columna Atributos y saber si hay que sumarle la variante
    // "default" (categorías sin ningún atributo con precio propio).
    const definitionsCache = new Map<string, Awaited<ReturnType<AttributeService["listForCategory"]>>>();
    const definitionsFor = async (categoryId: string) => {
      const cached = definitionsCache.get(categoryId);
      if (cached) return cached;
      const definitions = await this.attributes.listForCategory(categoryId, true);
      definitionsCache.set(categoryId, definitions);
      return definitions;
    };

    // Segunda pasada: recién acá se resuelve la columna Atributos (necesita los atributos de la
    // categoría de cada fila, que recién se conoce después de la primera pasada) y se valida contra
    // las mismas reglas que rigen la carga manual de un producto (obligatorios, tipo de valor,
    // opción válida, etc. — ver product.service.ts buildAttributeValuesData).
    const attributeValuesByRow = new Map<number, AttributeValueWrite[]>();
    const hasPricedVariantsCache = new Map<string, boolean>();
    for (const op of ops) {
      const definitions = await definitionsFor(op.categoryId);
      hasPricedVariantsCache.set(
        op.categoryId,
        definitions.some((attr) => attr.variantMode === AttributeVariantMode.PRICED_VARIANT),
      );
      try {
        const pairs = parseAtributosCell(op.atributosRaw);
        const inputs = resolveAttributeInputs(pairs, definitions);
        attributeValuesByRow.set(op.row, await this.products.buildAttributeValuesData(op.categoryId, inputs));
      } catch (e) {
        errors.push({ row: op.row, message: e instanceof Error ? e.message : String(e) });
      }
    }

    if (errors.length > 0) {
      // A diferencia del primer chequeo (categoría/marca/nombre), acá cada fila con error YA está
      // contada en `ops` (pasó la primera pasada) — sumar errors.length de nuevo duplicaría el total.
      errors.sort((a, b) => a.row - b.row);
      return { total: ops.length, created: 0, errors };
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
            attributeValues: { create: attributeValuesByRow.get(op.row) ?? [] },
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

/** "Genero=Unisex; Concentracion=Eau de Parfum" -> [{name:"Genero", value:"Unisex"}, ...]. Tira si
 * algún trozo no tiene la forma Nombre=Valor — el mensaje queda como error de esa fila. */
function parseAtributosCell(raw: string): { name: string; value: string }[] {
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=");
      const name = eq === -1 ? "" : part.slice(0, eq).trim();
      const value = eq === -1 ? "" : part.slice(eq + 1).trim();
      if (!name || !value) {
        throw new Error(`Formato inválido en "${part}" de la columna Atributos — usá Nombre=Valor.`);
      }
      return { name, value };
    });
}

/** Resuelve nombres/valores en texto (lo que trae la planilla) a attributeId/optionId (lo que espera
 * product.service.ts) contra los atributos NONE de esta categoría (propios + heredados). Solo hace la
 * traducción texto -> id; la validación real (obligatorios, allowMultiple, tipo) la hace
 * buildAttributeValuesData después, para no duplicarla. */
function resolveAttributeInputs(
  pairs: { name: string; value: string }[],
  definitions: Array<{
    id: string;
    name: string;
    type: AttributeType;
    variantMode: AttributeVariantMode;
    options: { id: string; value: string }[];
  }>,
): ProductAttributeValueInputDto[] {
  const byName = new Map(
    definitions.filter((d) => d.variantMode === AttributeVariantMode.NONE).map((d) => [d.name.trim().toLowerCase(), d]),
  );
  return pairs.map(({ name, value }) => {
    const definition = byName.get(name.trim().toLowerCase());
    if (!definition) {
      throw new Error(
        `El atributo "${name}" de la columna Atributos no existe para esta categoría (o tiene variante propia) — ver hoja "Atributos existentes".`,
      );
    }
    switch (definition.type) {
      case AttributeType.TEXT:
        return { attributeId: definition.id, valueText: value };
      case AttributeType.NUMBER: {
        const parsed = Number(value.replace(",", "."));
        if (Number.isNaN(parsed)) {
          throw new Error(`"${value}" no es un número válido para el atributo "${definition.name}".`);
        }
        return { attributeId: definition.id, valueNumber: parsed };
      }
      case AttributeType.BOOLEAN: {
        const normalized = value.trim().toLowerCase();
        if (["si", "sí", "true", "1"].includes(normalized)) return { attributeId: definition.id, valueBoolean: true };
        if (["no", "false", "0"].includes(normalized)) return { attributeId: definition.id, valueBoolean: false };
        throw new Error(`"${value}" no es Sí/No para el atributo "${definition.name}".`);
      }
      case AttributeType.SELECT: {
        const option = definition.options.find((o) => o.value.trim().toLowerCase() === value.trim().toLowerCase());
        if (!option) {
          throw new Error(
            `"${value}" no es un valor válido para el atributo "${definition.name}" — ver hoja "Atributos existentes".`,
          );
        }
        return { attributeId: definition.id, optionId: option.id };
      }
    }
  });
}
