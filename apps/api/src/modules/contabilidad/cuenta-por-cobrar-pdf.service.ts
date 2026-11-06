import { existsSync } from "node:fs";
import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { ES_GOLD, ES_LINE, ES_MUTED, ES_NAVY_900, FONT_BOLD, FONT_REGULAR, LOGO_PATH } from "../proformas/proforma-pdf.service";
import { CuentaPorCobrarService } from "./cuenta-por-cobrar.service";

const MARGIN = 40;
const ES_SALE = "#B8412F";
const ROW_HEIGHT = 20;
// Dónde corta el contenido de cada página: deja lugar al pie (línea + número de página).
const CONTENT_BOTTOM_GAP = 60;

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function bs(value: number | string): string {
  return `Bs ${Number(value).toFixed(2)}`;
}

/**
 * Estado de cuenta de un cliente: sus deudas pendientes (una fila por nota de venta con fecha, total, cobrado y saldo) y el
 * total adeudado. A4 vertical — a diferencia de la proforma (media carta horizontal), acá puede haber muchas filas y cortar
 * en varias páginas. Mismo estilo de marca que los demás PDF (logo negro, filete dorado, Roboto para acentos y ñ).
 */
@Injectable()
export class CuentaPorCobrarPdfService {
  constructor(private readonly cuentas: CuentaPorCobrarService) {}

  async generate(clienteId: string, rango: { fechaDesde?: string; fechaHasta?: string }): Promise<Buffer> {
    const { cliente, cuentas } = await this.cuentas.pendientesDeCliente(clienteId, rango);

    const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
    doc.registerFont("Roboto", FONT_REGULAR);
    doc.registerFont("Roboto-Bold", FONT_BOLD);
    doc.font("Roboto");
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    let y = this.drawHeader(doc, cliente.nombre, rango);
    y = this.drawTableHead(doc, y);

    let totalGeneral = 0;
    let cobradoGeneral = 0;
    let saldoGeneral = 0;
    const limite = doc.page.height - CONTENT_BOTTOM_GAP;

    cuentas.forEach((c, i) => {
      if (y + ROW_HEIGHT > limite) {
        doc.addPage();
        y = this.drawTableHead(doc, MARGIN);
      }
      const total = Number(c.montoTotal);
      const saldo = Number(c.montoAdeudado);
      const cobrado = total - saldo;
      totalGeneral += total;
      cobradoGeneral += cobrado;
      saldoGeneral += saldo;

      if (i % 2 === 1) doc.rect(MARGIN, y, doc.page.width - MARGIN * 2, ROW_HEIGHT).fillColor("#F5F7FA").fill();
      doc.fillColor(ES_NAVY_900).font("Roboto").fontSize(9);
      const cols = this.columnas(doc);
      doc.text(formatDate(c.proforma.fecha), cols.fecha.x, y + 6, { width: cols.fecha.w });
      doc.text(c.proforma.codigo, cols.codigo.x, y + 6, { width: cols.codigo.w });
      doc.text(bs(total), cols.total.x, y + 6, { width: cols.total.w, align: "right" });
      doc.text(bs(cobrado), cols.cobrado.x, y + 6, { width: cols.cobrado.w, align: "right" });
      doc.font("Roboto-Bold").text(bs(saldo), cols.saldo.x, y + 6, { width: cols.saldo.w, align: "right" });
      y += ROW_HEIGHT;
    });

    // Totales: si no entran en lo que queda de la página, pasan a una nueva.
    if (y + 70 > limite) {
      doc.addPage();
      y = MARGIN;
    }
    y += 6;
    doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).strokeColor(ES_NAVY_900).lineWidth(0.75).stroke();
    y += 8;
    const cols = this.columnas(doc);
    doc.font("Roboto-Bold").fontSize(9).fillColor(ES_NAVY_900);
    doc.text(`TOTAL (${cuentas.length} ${cuentas.length === 1 ? "deuda" : "deudas"})`, cols.fecha.x, y + 2, { width: cols.fecha.w + cols.codigo.w });
    doc.text(bs(totalGeneral), cols.total.x, y + 2, { width: cols.total.w, align: "right" });
    doc.text(bs(cobradoGeneral), cols.cobrado.x, y + 2, { width: cols.cobrado.w, align: "right" });
    doc.fillColor(ES_SALE).text(bs(saldoGeneral), cols.saldo.x, y + 2, { width: cols.saldo.w, align: "right" });
    y += 24;

    doc.font("Roboto-Bold").fontSize(11).fillColor(ES_NAVY_900);
    doc.text("SALDO PENDIENTE A PAGAR", MARGIN, y, { width: doc.page.width - MARGIN * 2 - 130 });
    doc.fillColor(ES_SALE).text(bs(saldoGeneral), doc.page.width - MARGIN - 130, y, { width: 130, align: "right" });

    if (cuentas.length === 0) {
      doc.font("Roboto").fontSize(10).fillColor(ES_MUTED);
      doc.text("Este cliente no tiene deudas pendientes en el período indicado.", MARGIN, y + 30, { width: doc.page.width - MARGIN * 2 });
    }

    this.drawFooter(doc);
    doc.end();
    return done;
  }

  private columnas(doc: PDFKit.PDFDocument) {
    const ancho = doc.page.width - MARGIN * 2;
    const fecha = { x: MARGIN + 6, w: 80 };
    const codigo = { x: fecha.x + fecha.w, w: 110 };
    const resto = (ancho - 6 - fecha.w - codigo.w) / 3;
    const total = { x: codigo.x + codigo.w, w: resto - 6 };
    const cobrado = { x: total.x + resto, w: resto - 6 };
    const saldo = { x: cobrado.x + resto, w: resto - 6 };
    return { fecha, codigo, total, cobrado, saldo };
  }

  private drawHeader(doc: PDFKit.PDFDocument, cliente: string, rango: { fechaDesde?: string; fechaHasta?: string }): number {
    const pageWidth = doc.page.width;
    let y = 34;

    const logoWidth = 120;
    const logoHeight = 30;
    if (existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, (pageWidth - logoWidth) / 2, y, { width: logoWidth, height: logoHeight, fit: [logoWidth, logoHeight] });
      } catch {
        // Best-effort: sin logo si el archivo no es una imagen válida.
      }
    }
    y += logoHeight + 12;

    const ruleWidth = 40;
    doc.moveTo((pageWidth - ruleWidth) / 2, y).lineTo((pageWidth + ruleWidth) / 2, y).strokeColor(ES_GOLD).lineWidth(1.5).stroke();
    y += 14;

    doc.font("Roboto-Bold").fontSize(15).fillColor(ES_NAVY_900);
    doc.text("ESTADO DE CUENTA", 0, y, { width: pageWidth, align: "center", characterSpacing: 1.5 });
    y += 24;

    doc.font("Roboto").fontSize(10).fillColor(ES_NAVY_900);
    doc.text(`Cliente: `, MARGIN, y, { continued: true }).font("Roboto-Bold").text(cliente);
    y += 15;
    doc.font("Roboto").fontSize(9).fillColor(ES_MUTED);
    const periodo =
      rango.fechaDesde || rango.fechaHasta
        ? `Período: ${rango.fechaDesde ? formatDate(rango.fechaDesde) : "inicio"} al ${rango.fechaHasta ? formatDate(rango.fechaHasta) : "hoy"}`
        : "Período: todas las deudas pendientes";
    doc.text(`Emitido el ${formatDate(new Date())}  ·  ${periodo}`, MARGIN, y);
    y += 20;

    doc.fillColor("#000000");
    return y;
  }

  private drawTableHead(doc: PDFKit.PDFDocument, y: number): number {
    const cols = this.columnas(doc);
    doc.font("Roboto-Bold").fontSize(8).fillColor(ES_MUTED);
    doc.text("FECHA", cols.fecha.x, y, { width: cols.fecha.w });
    doc.text("N° NOTA", cols.codigo.x, y, { width: cols.codigo.w });
    doc.text("TOTAL", cols.total.x, y, { width: cols.total.w, align: "right" });
    doc.text("COBRADO", cols.cobrado.x, y, { width: cols.cobrado.w, align: "right" });
    doc.text("SALDO", cols.saldo.x, y, { width: cols.saldo.w, align: "right" });
    y += 14;
    doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).strokeColor(ES_LINE).lineWidth(0.75).stroke();
    return y + 2;
  }

  private drawFooter(doc: PDFKit.PDFDocument) {
    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i++) {
      doc.switchToPage(pageRange.start + i);
      // Evita que pdfkit agregue una página en blanco de más al escribir dentro del margen inferior.
      doc.page.margins.bottom = 0;
      const width = doc.page.width - MARGIN * 2;
      const lineY = doc.page.height - 44;
      doc.moveTo(MARGIN, lineY).lineTo(doc.page.width - MARGIN, lineY).strokeColor(ES_LINE).lineWidth(0.5).stroke();
      doc.fontSize(7).font("Roboto").fillColor(ES_MUTED);
      doc.text(`Página ${i + 1} de ${pageRange.count}`, MARGIN, lineY + 10, { width, align: "center" });
      doc.fillColor("#000000");
    }
  }
}
