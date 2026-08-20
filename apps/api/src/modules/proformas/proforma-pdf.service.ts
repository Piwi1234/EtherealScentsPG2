import { existsSync } from "node:fs";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { TipoProforma } from "@app/database";
import { ProformasService } from "./proformas.service";
import { EMPRESA_LOGOS_DIR } from "../empresas/empresa-logo.multer";

const NAVY = "#1B3A6B";
const MUTED = "#6B7280";
const LINE = "#E2E5EA";

// Media carta horizontal (8.5 x 5.5 in = 612 x 396 pt) — más chico que A4, por eso los márgenes y
// tamaños de fuente de acá son más ajustados que un documento tamaño carta/A4 normal.
const PAGE_SIZE: [number, number] = [612, 396];
const PAGE_MARGIN = 24;
// Sin franja de color: el encabezado (título + N° + logo) va sobre fondo blanco, delimitado abajo
// por una doble línea divisoria en vez de una banda.
const TOP_ZONE_HEIGHT = 66;
// Centrado (horizontal y vertical) dentro de una franja propia a la derecha del encabezado — no
// pegado al borde de la hoja, sino más hacia el medio de ese lado (ver logoZoneX en drawHeader).
// Un poco más chico que antes y corrido hacia abajo del centro exacto (a pedido), sin pasarse de
// la doble línea divisoria.
const LOGO_SIZE = 54;
const LOGO_ZONE_WIDTH = 170;
const LOGO_Y = (TOP_ZONE_HEIGHT - LOGO_SIZE) / 2 + 5;

// Helvetica (fuente estándar de pdfkit) no tiene tabla ToUnicode ni cubre bien acentos/ñ/° —
// el texto se ve/extrae mal ("Tama�o"). Roboto sí es Unicode completo; se embebe desde acá en vez
// de depender de fuentes del sistema operativo (no hay garantía de que existan en el servidor).
const FONTS_DIR = join(process.cwd(), "assets", "fonts");
const FONT_REGULAR = join(FONTS_DIR, "Roboto-Regular.ttf");
const FONT_BOLD = join(FONTS_DIR, "Roboto-Medium.ttf");

type Proforma = Awaited<ReturnType<ProformasService["findOne"]>>;
type Detalle = Proforma["detalles"][number];

function money(value: number | string, prefix: string): string {
  return `${prefix} ${Number(value).toFixed(2)}`;
}

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/** Mismo criterio que AtributosVisibles.tsx (frontend): junta attributeValues (NONE) +
 * variantOptionValues (MULTI_VALUE), solo mostrarEnProforma=true, ordenados por `orden`. */
function atributosHeredadosLabel(product: Detalle["variante"]["product"]): string {
  const porAtributo = new Map<string, { orden: number; nombre: string; valor: string }>();

  for (const pv of product.attributeValues) {
    if (!pv.attribute.mostrarEnProforma) continue;
    const valor = pv.option ? pv.option.value : pv.valueText ?? pv.valueNumber ?? (pv.valueBoolean ? "Sí" : pv.valueBoolean === false ? "No" : "—");
    porAtributo.set(pv.attributeId, { orden: pv.attribute.orden, nombre: pv.attribute.name, valor: String(valor) });
  }
  for (const v of product.variantOptionValues) {
    if (!v.attribute.mostrarEnProforma || v.attribute.variantMode !== "MULTI_VALUE") continue;
    const existing = porAtributo.get(v.attributeId);
    if (existing) existing.valor = `${existing.valor}, ${v.value}`;
    else porAtributo.set(v.attributeId, { orden: v.attribute.orden, nombre: v.attribute.name, valor: v.value });
  }

  return Array.from(porAtributo.values())
    .sort((a, b) => a.orden - b.orden)
    .map((a) => `${a.nombre}: ${a.valor}`)
    .join(", ");
}

function conceptoLabel(detalle: Detalle): string {
  const variante = detalle.variante;
  const propias = variante.options.map((o) => `${o.optionValue.attribute.name}: ${o.optionValue.value}`);
  const heredados = atributosHeredadosLabel(variante.product);
  const partes = [...propias, ...(heredados ? [heredados] : [])];
  return partes.length > 0 ? `${variante.product.name} (${partes.join(", ")})` : variante.product.name;
}

/**
 * Genera el PDF de una proforma — adaptación del modelo de factura clásico (banda superior con la
 * empresa, datos del cliente/proveedor a un lado y de la empresa al otro, tabla de conceptos,
 * totales) a los datos que este sistema realmente tiene. A propósito NO incluye reparto por almacén
 * ni historial de estados — eso queda solo en la vista web.
 */
@Injectable()
export class ProformaPdfService {
  constructor(private readonly proformas: ProformasService) {}

  async generate(id: string): Promise<Buffer> {
    const proforma = await this.proformas.findOne(id);
    const esVenta = proforma.tipo === TipoProforma.VENTA;
    const prefix = esVenta ? "Bs" : "$";
    const tituloTipo = esVenta ? "Venta" : "Compra";
    const titulo = proforma.estado === "COMPLETADA" ? `Nota de ${tituloTipo}` : `Proforma de ${tituloTipo}`;

    const doc = new PDFDocument({ size: PAGE_SIZE, margin: PAGE_MARGIN, bufferPages: true });
    doc.registerFont("Roboto", FONT_REGULAR);
    doc.registerFont("Roboto-Bold", FONT_BOLD);
    doc.font("Roboto");
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    this.drawHeader(doc, proforma, titulo);
    this.drawInfoBlock(doc, proforma, esVenta);
    const subtotal = this.drawTable(doc, proforma, esVenta, prefix);
    this.drawTotales(doc, proforma, esVenta, prefix, subtotal);
    this.drawFooter(doc, proforma);

    doc.end();
    return done;
  }

  /** Sin banda de color: título + N° a la izquierda, logo a la derecha, sobre fondo blanco —
   * delimitado abajo por una doble línea divisoria (dibujada acá mismo, ver el final del método). */
  private drawHeader(doc: PDFKit.PDFDocument, proforma: Proforma, titulo: string) {
    const pageWidth = doc.page.width;

    const logoZoneX = pageWidth - PAGE_MARGIN - LOGO_ZONE_WIDTH;
    const logoX = logoZoneX + (LOGO_ZONE_WIDTH - LOGO_SIZE) / 2;
    const tituloWidth = logoZoneX - PAGE_MARGIN - 14;

    doc.fillColor(NAVY).fontSize(15).font("Roboto-Bold").text(titulo, PAGE_MARGIN, 8, { width: tituloWidth });
    doc.fontSize(10).font("Roboto").fillColor(MUTED).text(`N°: ${proforma.codigo}`, PAGE_MARGIN, 30, { width: tituloWidth });

    const logoFilename = proforma.empresa.logoUrl?.split("/").pop();
    const logoPath = logoFilename ? join(EMPRESA_LOGOS_DIR, logoFilename) : undefined;
    if (logoPath && existsSync(logoPath)) {
      try {
        doc.image(logoPath, logoX, LOGO_Y, { width: LOGO_SIZE, height: LOGO_SIZE, fit: [LOGO_SIZE, LOGO_SIZE] });
      } catch {
        // Best-effort: si el archivo no es una imagen válida, seguimos sin logo.
      }
    }

    // Doble línea divisoria en vez de la franja de color de antes.
    doc
      .moveTo(PAGE_MARGIN, TOP_ZONE_HEIGHT)
      .lineTo(pageWidth - PAGE_MARGIN, TOP_ZONE_HEIGHT)
      .strokeColor(NAVY)
      .lineWidth(1.2)
      .stroke();
    doc
      .moveTo(PAGE_MARGIN, TOP_ZONE_HEIGHT + 3)
      .lineTo(pageWidth - PAGE_MARGIN, TOP_ZONE_HEIGHT + 3)
      .strokeColor(NAVY)
      .lineWidth(1.2)
      .stroke();

    doc.fillColor("#000000");
  }

  private drawInfoBlock(doc: PDFKit.PDFDocument, proforma: Proforma, esVenta: boolean) {
    const y = TOP_ZONE_HEIGHT + 3 + 16;
    const colWidth = (doc.page.width - PAGE_MARGIN * 2 - 16) / 2;
    const leftX = PAGE_MARGIN;
    const rightX = PAGE_MARGIN + colWidth + 16;

    doc.fontSize(9).font("Roboto-Bold").fillColor(NAVY);
    doc.text(esVenta ? "DATOS DEL CLIENTE" : "DATOS DEL PROVEEDOR", leftX, y);
    doc.text("DATOS DE LA EMPRESA", rightX, y);

    doc.fontSize(8.5).font("Roboto").fillColor("#000000");
    let leftLines: string[];
    if (esVenta) {
      const cliente = proforma.cliente;
      leftLines = [
        cliente?.nombre ?? "—",
        cliente?.direccion ?? undefined,
        cliente?.email ?? undefined,
        cliente?.telefono ?? undefined,
        proforma.ciudadEntrega ? `Ciudad de entrega: ${proforma.ciudadEntrega.nombre}` : undefined,
      ].filter((l): l is string => Boolean(l));
    } else {
      const proveedor = proforma.proveedor;
      leftLines = [
        proveedor?.nombre ?? "—",
        proforma.paisProcedencia ? `País de procedencia: ${proforma.paisProcedencia.nombre}` : undefined,
        proforma.tipoCambioProf ? `Tipo de cambio: ${Number(proforma.tipoCambioProf).toFixed(4)}` : undefined,
      ].filter((l): l is string => Boolean(l));
    }
    const rightLines = [proforma.empresa.razonSocial];

    let ly = y + 14;
    for (const line of leftLines) {
      doc.text(line, leftX, ly, { width: colWidth });
      ly += 13;
    }
    let ry = y + 14;
    for (const line of rightLines) {
      doc.text(line, rightX, ry, { width: colWidth });
      ry += 13;
    }

    const infoBottom = Math.max(ly, ry) + 4;
    doc.fontSize(8.5).font("Roboto-Bold").fillColor(NAVY).text(`Fecha: ${formatDate(proforma.fecha)}`, leftX, infoBottom);
    doc.fillColor("#000000");
    doc.y = infoBottom + 12;
  }

  /** Devuelve el subtotal acumulado (suma de detalle.subtotal) para que drawTotales no repita la cuenta. */
  private drawTable(doc: PDFKit.PDFDocument, proforma: Proforma, esVenta: boolean, prefix: string): number {
    const left = PAGE_MARGIN;
    const width = doc.page.width - PAGE_MARGIN * 2;
    const colMarca = width * 0.16;
    const colConcepto = width * 0.36;
    const colCantidad = width * 0.12;
    const colPrecio = width * 0.16;
    const colTotal = width * 0.2;

    const drawTableHeader = (y: number) => {
      doc.rect(left, y, width, 20).fill(NAVY);
      doc.fillColor("#ffffff").fontSize(7.5).font("Roboto-Bold");
      doc.text("MARCA", left + 6, y + 6, { width: colMarca - 6 });
      doc.text("CONCEPTO", left + colMarca, y + 6, { width: colConcepto });
      doc.text("CANT.", left + colMarca + colConcepto, y + 6, { width: colCantidad, align: "center" });
      doc.text("PRECIO", left + colMarca + colConcepto + colCantidad, y + 6, { width: colPrecio, align: "right" });
      doc.text("TOTAL", left + colMarca + colConcepto + colCantidad + colPrecio, y + 6, { width: colTotal - 6, align: "right" });
      doc.fillColor("#000000");
      return y + 20;
    };

    let y = drawTableHeader(doc.y);
    let subtotal = 0;

    for (const detalle of proforma.detalles) {
      const concepto = conceptoLabel(detalle);
      const marca = detalle.variante.product.brand?.name ?? "—";
      const precioUnitario = esVenta
        ? Number(detalle.precioUnitario ?? 0)
        : Number(detalle.precioCompra ?? 0) + Number(detalle.costoEnvio ?? 0) + Number(detalle.costoSeguridad ?? 0) + Number(detalle.costoLogistica ?? 0);
      const total = Number(detalle.subtotal);
      subtotal += total;

      doc.fontSize(8).font("Roboto");
      const rowHeight = Math.max(20, doc.heightOfString(concepto, { width: colConcepto }) + 10);

      if (y + rowHeight > doc.page.height - PAGE_MARGIN - 110) {
        doc.addPage();
        y = drawTableHeader(PAGE_MARGIN);
      }

      doc.text(marca, left + 6, y + 5, { width: colMarca - 6 });
      doc.text(concepto, left + colMarca, y + 5, { width: colConcepto });
      doc.text(String(detalle.cantidad), left + colMarca + colConcepto, y + 5, { width: colCantidad, align: "center" });
      doc.text(money(precioUnitario, prefix), left + colMarca + colConcepto + colCantidad, y + 5, { width: colPrecio, align: "right" });
      doc.text(money(total, prefix), left + colMarca + colConcepto + colCantidad + colPrecio, y + 5, { width: colTotal - 6, align: "right" });

      y += rowHeight;
      doc.moveTo(left, y).lineTo(left + width, y).strokeColor(LINE).lineWidth(0.5).stroke();
    }

    doc.y = y + 12;
    return subtotal;
  }

  private drawTotales(doc: PDFKit.PDFDocument, proforma: Proforma, esVenta: boolean, prefix: string, subtotal: number) {
    const width = doc.page.width - PAGE_MARGIN * 2;
    const left = PAGE_MARGIN;
    let y = doc.y;

    const row = (label: string, value: string, strong = false) => {
      doc.fontSize(strong ? 10 : 8.5).font(strong ? "Roboto-Bold" : "Roboto");
      doc.fillColor(strong ? NAVY : "#000000").text(label, left, y, { width: width - 90 });
      doc.text(value, left + width - 90, y, { width: 90, align: "right" });
      doc.fillColor("#000000");
      y += strong ? 16 : 13;
    };

    row("Subtotal", money(subtotal, prefix));

    if (esVenta) {
      const descuento = Number(proforma.descuentoGeneral ?? 0);
      const total = subtotal - descuento;
      if (descuento > 0) row("Descuento general", `-${money(descuento, prefix)}`);
      row("Total", money(total, prefix), true);

      const porcentaje = Number(proforma.adelantoPorcentaje ?? 0);
      if (porcentaje > 0) {
        const montoAdelanto = total * (porcentaje / 100);
        row(`Adelanto (${porcentaje}%)`, money(montoAdelanto, prefix));
        row("Saldo", money(total - montoAdelanto, prefix), true);
      }
      if (proforma.cuentaPorCobrar && proforma.cuentaPorCobrar.estado === "PENDIENTE") {
        row("Saldo pendiente por cobrar", money(Number(proforma.cuentaPorCobrar.montoAdeudado), prefix));
      }
    } else {
      row("Total", money(subtotal, prefix), true);
      if (proforma.tipoCambioProf) {
        row("Tipo de cambio", Number(proforma.tipoCambioProf).toFixed(4));
        row("Total Bs", money(subtotal * Number(proforma.tipoCambioProf), "Bs"), true);
      }
    }

    doc.y = y + 8;
  }

  private drawFooter(doc: PDFKit.PDFDocument, proforma: Proforma) {
    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i++) {
      doc.switchToPage(pageRange.start + i);
      // El footer se dibuja a propósito dentro de lo que pdfkit considera "margen inferior" — sin
      // esto, cualquier .text() ahí abajo hace que pdfkit crea que el contenido no entra y agregue
      // una página en blanco extra al final (bug reportado: proforma recién creada con pocas líneas
      // igual generaba una segunda hoja vacía).
      doc.page.margins.bottom = 0;
      const y = doc.page.height - 34;
      doc
        .moveTo(PAGE_MARGIN, y)
        .lineTo(doc.page.width - PAGE_MARGIN, y)
        .strokeColor(LINE)
        .lineWidth(0.5)
        .stroke();
      doc
        .fontSize(6.5)
        .font("Roboto")
        .fillColor(MUTED)
        .text(
          `Creado por: ${proforma.creadoPor.nombre} — Generado el ${formatDate(new Date())} — Página ${i + 1} de ${pageRange.count}`,
          PAGE_MARGIN,
          y + 5,
          { width: doc.page.width - PAGE_MARGIN * 2, align: "center" },
        );
      doc.fillColor("#000000");
    }
  }
}
