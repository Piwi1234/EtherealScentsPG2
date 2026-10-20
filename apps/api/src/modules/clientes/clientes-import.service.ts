import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { OrigenCliente, TipoCliente } from "@app/database";
import { PrismaService } from "../../common/prisma.service";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E6F7" } };

export interface ClienteImportRowError {
  row: number;
  message: string;
}

export interface ClienteImportReport {
  total: number;
  created: number;
  updated: number;
  errors: ClienteImportRowError[];
}

type CiudadRow = { id: string; nombre: string };
type ClienteRow = { id: string; email: string | null };

/** Mismo esqueleto que BrandImportService (ver su comentario) — plantilla .xlsx en vivo + import
 * "todo o nada" (valida todas las filas antes de tocar la base, recién aplica si no hay errores). */
@Injectable()
export class ClientesImportService {
  constructor(private readonly prisma: PrismaService) {}

  async buildTemplate(): Promise<Buffer> {
    const ciudades = await this.prisma.ciudad.findMany({ select: { nombre: true }, orderBy: { nombre: "asc" } });

    const wb = new ExcelJS.Workbook();
    wb.creator = "Ethereal Scents";
    wb.created = new Date();

    const info = wb.addWorksheet("Instrucciones");
    info.columns = [{ width: 22 }, { width: 100 }];
    const title = info.addRow(["Plantilla de importación de Clientes", ""]);
    title.font = { bold: true, size: 14 };
    info.addRow([]);
    const headerRow = info.addRow(["Columna", "Regla"]);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => (cell.fill = HEADER_FILL));
    const rules: [string, string][] = [
      ["Tipo", 'Opcional. "Natural" o "Jurídica" — si se deja vacío, queda como Natural.'],
      ["Nombre", 'Obligatorio. Nombre completo (Natural) o razón social (Jurídica).'],
      ["Email", "Opcional, pero si se carga tiene que ser único — si ya existe un cliente con ese email, se actualiza en vez de duplicarse."],
      ["Teléfono", "Opcional."],
      ["Ciudad", 'Opcional. Nombre EXACTO — ver hoja "Ciudades existentes".'],
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
      "- Borrá la fila de ejemplo (en gris cursiva) antes de importar, o se va a crear como un cliente real.",
      "- Sin Email no hay forma de identificar que una fila es \"el mismo cliente\" en una importación futura — esas filas siempre crean un cliente nuevo, nunca actualizan uno existente.",
      "- La importación es todo o nada: si una fila tiene un error, no se crea ni actualiza ningún cliente hasta que lo corrijas y vuelvas a subir el archivo.",
    ];
    for (const note of notes) {
      const row = info.addRow([note]);
      info.mergeCells(`A${row.number}:B${row.number}`);
      row.getCell(1).alignment = { wrapText: true };
    }

    const sheet = wb.addWorksheet("Clientes");
    sheet.columns = [
      { header: "Tipo", key: "tipo", width: 14 },
      { header: "Nombre", key: "nombre", width: 28 },
      { header: "Email", key: "email", width: 28 },
      { header: "Teléfono", key: "telefono", width: 18 },
      { header: "Ciudad", key: "ciudad", width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const exampleRow = sheet.addRow({
      tipo: "Natural",
      nombre: "Juan Pérez",
      email: "juan.perez@ejemplo.com",
      telefono: "70012345",
      ciudad: ciudades[0]?.nombre ?? "",
    });
    exampleRow.font = { italic: true, color: { argb: "FF888888" } };
    for (let i = 0; i < 30; i++) sheet.addRow({});

    const ref = wb.addWorksheet("Ciudades existentes");
    ref.columns = [{ header: "Nombre", key: "nombre", width: 26 }];
    ref.getRow(1).font = { bold: true };
    ref.getRow(1).eachCell((cell) => (cell.fill = HEADER_FILL));
    for (const c of ciudades) ref.addRow({ nombre: c.nombre });

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async importFromFile(buffer: Buffer, creadoPorId: string): Promise<ClienteImportReport> {
    const wb = new ExcelJS.Workbook();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException("No se pudo leer el archivo — tiene que ser un Excel (.xlsx) válido.");
    }
    const sheet = wb.getWorksheet("Clientes");
    if (!sheet) {
      throw new BadRequestException('El archivo no tiene una hoja llamada "Clientes".');
    }

    const [ciudades, existingClientes] = await Promise.all([
      this.prisma.ciudad.findMany({ select: { id: true, nombre: true } }),
      this.prisma.cliente.findMany({ where: { email: { not: null } }, select: { id: true, email: true } }),
    ]);
    const ciudadByName = new Map<string, CiudadRow>(ciudades.map((c) => [c.nombre.trim().toLowerCase(), c]));
    const existingByEmail = new Map<string, ClienteRow>(
      existingClientes.filter((c): c is ClienteRow & { email: string } => c.email !== null).map((c) => [c.email.toLowerCase(), c]),
    );

    type Op = {
      row: number;
      tipo: TipoCliente;
      nombre: string;
      email: string | null;
      telefono: string | null;
      ciudadId: string | null;
      existingId: string | null;
    };
    const ops: Op[] = [];
    const errors: ClienteImportRowError[] = [];
    const seenEmailRows = new Map<string, number>();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const nombre = cellText(row.getCell(2).value);
      if (!nombre) return;

      const rawTipo = cellText(row.getCell(1).value);
      const rawEmail = cellText(row.getCell(3).value);
      const rawTelefono = cellText(row.getCell(4).value);
      const rawCiudad = cellText(row.getCell(5).value);

      let hasError = false;
      const fail = (message: string) => {
        errors.push({ row: rowNumber, message });
        hasError = true;
      };

      let tipo: TipoCliente = TipoCliente.NATURAL;
      if (rawTipo) {
        const normalized = rawTipo.trim().toLowerCase();
        if (normalized === "natural") tipo = TipoCliente.NATURAL;
        else if (normalized === "jurídica" || normalized === "juridica") tipo = TipoCliente.JURIDICA;
        else fail(`Tipo "${rawTipo}" inválido — tiene que ser "Natural" o "Jurídica".`);
      }

      let email: string | null = null;
      let existingId: string | null = null;
      if (rawEmail) {
        if (!EMAIL_PATTERN.test(rawEmail)) {
          fail(`Email "${rawEmail}" no tiene un formato válido.`);
        } else {
          email = rawEmail.toLowerCase();
          if (seenEmailRows.has(email)) {
            fail(`Email "${rawEmail}" repetido (ya aparece en la fila ${seenEmailRows.get(email)}).`);
          }
          seenEmailRows.set(email, rowNumber);
          existingId = existingByEmail.get(email)?.id ?? null;
        }
      }

      let ciudadId: string | null = null;
      if (rawCiudad) {
        const ciudad = ciudadByName.get(rawCiudad.trim().toLowerCase());
        if (ciudad) ciudadId = ciudad.id;
        else fail(`Ciudad "${rawCiudad}" no existe.`);
      }

      if (!hasError) {
        ops.push({
          row: rowNumber,
          tipo,
          nombre,
          email,
          telefono: rawTelefono || null,
          ciudadId,
          existingId,
        });
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
          await tx.cliente.update({
            where: { id: op.existingId },
            data: { tipo: op.tipo, nombre: op.nombre, telefono: op.telefono, ciudadId: op.ciudadId },
          });
          updated++;
        } else {
          await tx.cliente.create({
            data: {
              tipo: op.tipo,
              nombre: op.nombre,
              email: op.email,
              telefono: op.telefono,
              ciudadId: op.ciudadId,
              origen: OrigenCliente.MANUAL,
              creadoPorId,
            },
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
