import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { slugify } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E6F7" } };

export interface BrandImportRowError {
  row: number;
  message: string;
}

export interface BrandImportReport {
  total: number;
  created: number;
  updated: number;
  errors: BrandImportRowError[];
}

type CategoryRow = { id: string; name: string; parentId: string | null };
type BrandRow = { id: string; name: string; slug: string };

@Injectable()
export class BrandImportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Plantilla .xlsx en vivo: instrucciones + hoja a llenar + referencia de categorías/marcas actuales. */
  async buildTemplate(): Promise<Buffer> {
    const [categories, brands] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true, parentId: true }, orderBy: { name: "asc" } }),
      this.prisma.brand.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    ]);
    const catById = new Map(categories.map((c) => [c.id, c]));
    const subcategories = categories
      .filter((c) => c.parentId !== null)
      .map((c) => ({ name: c.name, root: catById.get(c.parentId as string)?.name ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const wb = new ExcelJS.Workbook();
    wb.creator = "Ethereal Scents";
    wb.created = new Date();

    const info = wb.addWorksheet("Instrucciones");
    info.columns = [{ width: 22 }, { width: 100 }];
    const title = info.addRow(["Plantilla de importación de Marcas", ""]);
    title.font = { bold: true, size: 14 };
    info.addRow([]);
    const headerRow = info.addRow(["Columna", "Regla"]);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => (cell.fill = HEADER_FILL));
    const rules: [string, string][] = [
      ["Nombre", 'Obligatorio. Nombre de la marca (ej. "Armaf").'],
      ["Slug", "Opcional. Si se deja vacío, se genera automáticamente desde el Nombre."],
      [
        "Categorías",
        'Opcional. Subcategorías a las que se asigna la marca, separadas por coma (ej. "Arabes, Diseñador"). ' +
          'Nombres EXACTOS — ver hoja "Categorías existentes". Solo subcategorías, nunca una categoría raíz.',
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
      "- Borrá la fila de ejemplo (en gris cursiva) antes de importar, o se va a crear como una marca real.",
      "- El logo de la marca no se carga por esta planilla — se sube aparte, desde Marcas en el Dashboard.",
      "- Si una marca con ese Nombre ya existe (sin distinguir mayúsculas), se actualiza en vez de duplicarse.",
      "- La importación es todo o nada: si una fila tiene un error, no se crea ni actualiza ninguna marca hasta que lo corrijas y vuelvas a subir el archivo.",
    ];
    for (const note of notes) {
      const row = info.addRow([note]);
      info.mergeCells(`A${row.number}:B${row.number}`);
      row.getCell(1).alignment = { wrapText: true };
    }

    const sheet = wb.addWorksheet("Marcas");
    sheet.columns = [
      { header: "Nombre", key: "nombre", width: 28 },
      { header: "Slug", key: "slug", width: 22 },
      { header: "Categorías", key: "categorias", width: 40 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const exampleCats = subcategories.slice(0, 2).map((c) => c.name);
    const exampleRow = sheet.addRow({ nombre: "Lattafa", slug: "", categorias: exampleCats.join(", ") });
    exampleRow.font = { italic: true, color: { argb: "FF888888" } };
    for (let i = 0; i < 30; i++) sheet.addRow({});

    const ref = wb.addWorksheet("Categorías existentes");
    ref.columns = [
      { header: "Subcategoría", key: "nombre", width: 26 },
      { header: "Categoría Padre", key: "padre", width: 22 },
    ];
    ref.getRow(1).font = { bold: true };
    ref.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    for (const c of subcategories) ref.addRow({ nombre: c.name, padre: c.root });

    const brandRef = wb.addWorksheet("Marcas existentes");
    brandRef.columns = [{ header: "Nombre", key: "nombre", width: 26 }];
    brandRef.getRow(1).font = { bold: true };
    brandRef.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    for (const b of brands) brandRef.addRow({ nombre: b.name });

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * Todo o nada: primero valida todas las filas de la hoja "Marcas" (sin tocar la base), y solo si
   * no hay ningún error aplica los cambios en una sola transacción (upsert por nombre, sin distinguir
   * mayúsculas — reemplaza las categorías asignadas si la marca ya existía).
   */
  async importFromFile(buffer: Buffer): Promise<BrandImportReport> {
    const wb = new ExcelJS.Workbook();
    try {
      // El cast evita un choque de tipos de Buffer entre las @types/node del workspace y las que
      // trae exceljs — en runtime es un Buffer normal (viene de multer memoryStorage).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException("No se pudo leer el archivo — tiene que ser un Excel (.xlsx) válido.");
    }
    const sheet = wb.getWorksheet("Marcas");
    if (!sheet) {
      throw new BadRequestException('El archivo no tiene una hoja llamada "Marcas".');
    }

    const [categories, existingBrands] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
      this.prisma.brand.findMany({ select: { id: true, name: true, slug: true } }),
    ]);
    const subcategoryByName = new Map<string, CategoryRow>(
      categories.filter((c) => c.parentId !== null).map((c) => [c.name.trim().toLowerCase(), c]),
    );
    const rootNameSet = new Set(categories.filter((c) => c.parentId === null).map((c) => c.name.trim().toLowerCase()));
    const existingBrandByName = new Map<string, BrandRow>(existingBrands.map((b) => [b.name.trim().toLowerCase(), b]));
    const existingSlugOwner = new Map<string, BrandRow>(existingBrands.map((b) => [b.slug, b]));

    type Op = { row: number; name: string; slug: string; categoryIds: string[]; existingId: string | null };
    const ops: Op[] = [];
    const errors: BrandImportRowError[] = [];
    const seenNameRows = new Map<string, number>();
    const seenSlugRows = new Map<string, number>();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const name = cellText(row.getCell(1).value);
      if (!name) return;

      const rawSlug = cellText(row.getCell(2).value);
      const rawCategorias = cellText(row.getCell(3).value);

      let hasError = false;
      const fail = (message: string) => {
        errors.push({ row: rowNumber, message });
        hasError = true;
      };

      const nameKey = name.toLowerCase();
      if (seenNameRows.has(nameKey)) {
        fail(`Nombre "${name}" repetido (ya aparece en la fila ${seenNameRows.get(nameKey)}).`);
      }
      seenNameRows.set(nameKey, rowNumber);

      if (rawSlug && !SLUG_PATTERN.test(rawSlug)) {
        fail(`Slug "${rawSlug}" inválido — debe ser kebab-case (ej. "mi-marca").`);
      }

      const existing = existingBrandByName.get(nameKey);
      const slug = rawSlug || slugify(name);
      const slugOwner = existingSlugOwner.get(slug);
      if (slugOwner && slugOwner.id !== existing?.id) {
        fail(`Slug "${slug}" ya lo usa la marca "${slugOwner.name}".`);
      }
      if (seenSlugRows.has(slug) && seenSlugRows.get(slug) !== rowNumber) {
        fail(`Slug "${slug}" repetido (ya aparece en la fila ${seenSlugRows.get(slug)}).`);
      }
      seenSlugRows.set(slug, rowNumber);

      const categoryIds: string[] = [];
      if (rawCategorias) {
        for (const catName of rawCategorias.split(",").map((v) => v.trim()).filter(Boolean)) {
          const key = catName.toLowerCase();
          const sub = subcategoryByName.get(key);
          if (sub) {
            categoryIds.push(sub.id);
          } else if (rootNameSet.has(key)) {
            fail(`Categoría "${catName}" es una categoría raíz — una marca solo puede asignarse a subcategorías.`);
          } else {
            fail(`Categoría "${catName}" no existe.`);
          }
        }
      }

      if (!hasError) {
        ops.push({ row: rowNumber, name, slug, categoryIds, existingId: existing?.id ?? null });
      }
    });

    if (errors.length > 0) {
      errors.sort((a, b) => a.row - b.row);
      return { total: ops.length + errors.length, created: 0, updated: 0, errors };
    }

    let created = 0;
    let updated = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const op of ops) {
        if (op.existingId) {
          await tx.brandCategory.deleteMany({ where: { brandId: op.existingId } });
          await tx.brand.update({
            where: { id: op.existingId },
            data: { slug: op.slug, categories: { create: op.categoryIds.map((categoryId) => ({ categoryId })) } },
          });
          updated++;
        } else {
          await tx.brand.create({
            data: { name: op.name, slug: op.slug, categories: { create: op.categoryIds.map((categoryId) => ({ categoryId })) } },
          });
          created++;
        }
      }
    });

    return { total: ops.length, created, updated, errors: [] };
  }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text).trim();
  return String(value).trim();
}
