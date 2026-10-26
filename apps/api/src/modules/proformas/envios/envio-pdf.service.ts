import { existsSync } from "node:fs";
import { Injectable, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { EstadoEnvio } from "@app/database";
import { PrismaService } from "../../../common/prisma.service";
import { includeDetails } from "../proformas.service";
import {
  ES_GOLD,
  ES_GOLD_INK,
  ES_LINE,
  ES_MUTED,
  ES_NAVY_900,
  FONT_BOLD,
  FONT_REGULAR,
  LOGO_PATH,
  PAGE_MARGIN,
  PAGE_SIZE,
  atributosHeredadosLabel,
} from "../proforma-pdf.service";

const ESTADO_LABEL: Record<EstadoEnvio, string> = {
  ARMANDO: "Armando",
  EN_TRANSITO: "Enviado",
  RECIBIDO: "Recibido",
  ANULADO: "Anulado",
};

function formatDate(value: Date | string | null): string {
  return value ? new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";
}

/**
 * PDF de un envío: los productos que viajan, en orden alfabético, con su cantidad y el total de unidades. La nota al pie
 * del envío (si hay) se imprime en el pie de cada página, sobre el número de página. Mismo estilo que el PDF de proformas.
 */
@Injectable()
export class EnvioPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(id: string): Promise<Buffer> {
    const envio = await this.prisma.envio.findUnique({
      where: { id },
      include: {
        almacenDestino: true,
        items: {
          include: {
            compraDetalle: {
              select: {
                proveedor: { select: { nombre: true } },
                proforma: { select: { codigo: true } },
                variante: includeDetails.detalles.include.variante,
              },
            },
          },
        },
      },
    });
    if (!envio) throw new NotFoundException("Envío no encontrado.");

    // Orden alfabético por producto (y por variante dentro del mismo producto).
    const filas = envio.items
      .map((i) => {
        const v = i.compraDetalle.variante;
        const propias = v.options.map((o) => o.optionValue.value);
        const heredados = atributosHeredadosLabel(v.product);
        const partes = [...propias, ...(heredados ? [heredados] : [])];
        return {
          marca: v.product.brand?.name ?? "—",
          nombre: v.product.name,
          concepto: partes.length > 0 ? `${v.product.name} - ${partes.join(", ")}` : v.product.name,
          proveedor: i.compraDetalle.proveedor?.nombre ?? "—",
          compra: i.compraDetalle.proforma.codigo,
          cantidad: i.cantidad,
          recibida: i.cantidadRecibida,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }) || a.concepto.localeCompare(b.concepto, "es", { sensitivity: "base" }));
    const totalUnidades = filas.reduce((n, f) => n + f.cantidad, 0);
    const totalRecibidas = filas.reduce((n, f) => n + f.recibida, 0);
    const conRecepcion = totalRecibidas > 0;
    const nota = envio.notaPie?.trim() ?? "";

    const doc = new PDFDocument({ size: PAGE_SIZE, margin: PAGE_MARGIN, bufferPages: true });
    doc.registerFont("Roboto", FONT_REGULAR);
    doc.registerFont("Roboto-Bold", FONT_BOLD);
    doc.font("Roboto");
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    const width = doc.page.width - PAGE_MARGIN * 2;
    // Alto reservado al pie: línea + nota (si hay) + número de página.
    doc.font("Roboto").fontSize(6.5);
    const notaHeight = nota ? doc.heightOfString(nota, { width }) + 4 : 0;
    const footerHeight = 30 + notaHeight;
    const contentBottom = doc.page.height - footerHeight - 6;

    // --- Encabezado ---
    const pageWidth = doc.page.width;
    let y = 16;
    const logoWidth = 76;
    const logoHeight = 19;
    if (existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, (pageWidth - logoWidth) / 2, y, { width: logoWidth, height: logoHeight, fit: [logoWidth, logoHeight] });
      } catch {
        // Best-effort: sin logo si el archivo no es una imagen válida.
      }
    }
    y += logoHeight + 7;
    doc.moveTo((pageWidth - 26) / 2, y).lineTo((pageWidth + 26) / 2, y).strokeColor(ES_GOLD).lineWidth(1.3).stroke();
    y += 9;
    doc.font("Roboto-Bold").fontSize(11).fillColor(ES_NAVY_900);
    doc.text("ENVÍO", 0, y, { width: pageWidth, align: "center", characterSpacing: 1 });
    y += 13;
    doc.font("Roboto").fontSize(7).fillColor(ES_MUTED);
    doc.text(`N.° ${envio.codigo}  ·  ${formatDate(envio.fechaEnvio ?? envio.createdAt)}`, 0, y, { width: pageWidth, align: "center" });
    y += 12;
    doc.moveTo(PAGE_MARGIN, y).lineTo(pageWidth - PAGE_MARGIN, y).strokeColor(ES_LINE).lineWidth(0.75).stroke();
    y += 8;

    // --- Datos del envío ---
    const colW = width / 3;
    const datos: [string, string][] = [
      ["ALMACÉN DESTINO", envio.almacenDestino.nombre],
      ["ESTADO", ESTADO_LABEL[envio.estado]],
      ["TOTAL DE UNIDADES", conRecepcion ? `${totalUnidades} (llegaron ${totalRecibidas})` : String(totalUnidades)],
    ];
    datos.forEach(([titulo, valor], idx) => {
      const x = PAGE_MARGIN + colW * idx;
      doc.font("Roboto-Bold").fontSize(6.5).fillColor(ES_GOLD_INK).text(titulo, x, y, { width: colW - 8, characterSpacing: 0.5 });
      doc.font("Roboto").fontSize(8).fillColor("#000000").text(valor, x, y + 9, { width: colW - 8 });
    });
    y += 26;
    doc.moveTo(PAGE_MARGIN, y).lineTo(pageWidth - PAGE_MARGIN, y).strokeColor(ES_LINE).lineWidth(0.75).stroke();
    y += 8;

    // --- Tabla ---
    const left = PAGE_MARGIN;
    const colMarca = width * 0.15;
    const colConcepto = width * (conRecepcion ? 0.31 : 0.36);
    const colProveedor = width * 0.17;
    const colCompra = width * 0.13;
    const colCant = width * (conRecepcion ? 0.12 : 0.19);
    const colRecib = conRecepcion ? width * 0.12 : 0;
    const xConcepto = left + colMarca;
    const xProveedor = xConcepto + colConcepto;
    const xCompra = xProveedor + colProveedor;
    const xCant = xCompra + colCompra;
    const xRecib = xCant + colCant;

    const drawHeader = (top: number) => {
      doc.font("Roboto-Bold").fontSize(6).fillColor(ES_NAVY_900);
      doc.text("MARCA", left, top, { width: colMarca });
      doc.text("PRODUCTO", xConcepto, top, { width: colConcepto });
      doc.text("PROVEEDOR", xProveedor, top, { width: colProveedor });
      doc.text("COMPRA", xCompra, top, { width: colCompra });
      doc.text("CANT.", xCant, top, { width: colCant, align: "center" });
      if (conRecepcion) doc.text("LLEGARON", xRecib, top, { width: colRecib, align: "center" });
      const bottom = top + 9;
      doc.moveTo(left, bottom).lineTo(left + width, bottom).strokeColor(ES_NAVY_900).lineWidth(1).stroke();
      doc.fillColor("#000000");
      return bottom + 6;
    };

    y = drawHeader(y);
    for (const f of filas) {
      doc.fontSize(7.5).font("Roboto");
      const rowHeight = Math.max(16, doc.heightOfString(f.concepto, { width: colConcepto }) + 8);
      if (y + rowHeight > contentBottom) {
        doc.addPage();
        y = drawHeader(PAGE_MARGIN);
      }
      doc.font("Roboto").fillColor(ES_MUTED).text(f.marca, left, y + 3, { width: colMarca });
      doc.fillColor("#000000").text(f.concepto, xConcepto, y + 3, { width: colConcepto });
      doc.fillColor(ES_MUTED).text(f.proveedor, xProveedor, y + 3, { width: colProveedor });
      doc.text(f.compra, xCompra, y + 3, { width: colCompra });
      doc.font("Roboto-Bold").fillColor("#000000").text(String(f.cantidad), xCant, y + 3, { width: colCant, align: "center" });
      if (conRecepcion) doc.font("Roboto").text(String(f.recibida), xRecib, y + 3, { width: colRecib, align: "center" });
      y += rowHeight;
      doc.moveTo(left, y).lineTo(left + width, y).strokeColor(ES_LINE).lineWidth(0.5).stroke();
    }

    // --- Total de unidades ---
    if (y + 20 > contentBottom) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
    y += 6;
    doc.moveTo(left, y).lineTo(left + width, y).strokeColor(ES_NAVY_900).lineWidth(1).stroke();
    y += 5;
    doc.font("Roboto-Bold").fontSize(9).fillColor(ES_NAVY_900);
    doc.text("TOTAL DE UNIDADES", xConcepto, y, { width: colConcepto + colProveedor + colCompra, align: "right" });
    doc.text(String(totalUnidades), xCant, y, { width: colCant, align: "center" });
    if (conRecepcion) doc.text(String(totalRecibidas), xRecib, y, { width: colRecib, align: "center" });
    doc.fillColor("#000000");

    // --- Pie de cada página: nota + paginado ---
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0;
      const lineY = doc.page.height - footerHeight + 2;
      doc.moveTo(PAGE_MARGIN, lineY).lineTo(doc.page.width - PAGE_MARGIN, lineY).strokeColor(ES_LINE).lineWidth(0.5).stroke();
      let textY = lineY + 4;
      if (nota) {
        doc.fontSize(6.5).font("Roboto").fillColor(ES_NAVY_900).text(nota, PAGE_MARGIN, textY, { width, align: "left" });
        textY += notaHeight;
      }
      doc.fontSize(6).font("Roboto").fillColor(ES_MUTED).text(`Página ${i + 1} de ${range.count}`, PAGE_MARGIN, textY + 2, { width, align: "center" });
      doc.fillColor("#000000");
    }

    doc.end();
    return done;
  }
}
