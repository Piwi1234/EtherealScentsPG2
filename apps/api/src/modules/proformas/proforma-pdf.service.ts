import { existsSync } from "node:fs";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { TipoProforma } from "@app/database";
import { ProformasService } from "./proformas.service";

// Paleta "Ethereal Scents" (ver apps/web/src/app/globals.css, --es-*) — diseño "Minimalista" (opción
// D, aprobada), compartido por VENTA y COMPRA: mismo encabezado/tabla/pie con filetes en vez de
// bandas de color. Lo que cambia entre tipos es el CONTENIDO del bloque de info y de los totales
// (ver drawInfoBlockVenta/Compra y drawTotalesVenta/Compra más abajo) — Venta muestra cliente+validez
// de la proforma, Compra muestra proveedor+país de procedencia (y no lleva el disclaimer de envío del
// pie, que está escrito desde la perspectiva de que nosotros le entregamos algo al cliente).
const ES_NAVY_900 = "#0D1A30";
const ES_NAVY_700 = "#1C3561";
const ES_GOLD = "#C9A96E";
const ES_GOLD_INK = "#86672F";
const ES_MUTED = "#5F6778";
const ES_LINE = "#DDE2EB";
const ES_SALE = "#B8412F";
const VALIDEZ_PROFORMA = "1 día";
const DISCLAIMER_ENTREGA =
  "LOS RETRASOS DE ENTREGA PODRÍAN VARIAR EN CASO DE BLOQUEOS, TEMAS CLIMÁTICOS O MOTIVOS AJENOS A NUESTRA EMPRESA.";

// Media carta horizontal (8.5 x 5.5 in = 612 x 396 pt) — más chico que A4, por eso los márgenes y
// tamaños de fuente de acá son más ajustados que un documento tamaño carta/A4 normal.
const PAGE_SIZE: [number, number] = [612, 396];
const PAGE_MARGIN = 24;
// El pie (línea + disclaimer/paginado) se dibuja cerca de page.height - 32 (ver drawFooterVenta/
// Compra); el contenido puede llegar hasta un poco antes. Queda por encima del margen inferior de
// pdfkit (24), así ningún .text() dispara una página automática.
const FOOTER_TOP = PAGE_SIZE[1] - 34;
const CONTENT_BOTTOM = FOOTER_TOP - 6;

// Helvetica (fuente estándar de pdfkit) no tiene tabla ToUnicode ni cubre bien acentos/ñ/° —
// el texto se ve/extrae mal ("Tama�o"). Roboto sí es Unicode completo; se embebe desde acá en vez
// de depender de fuentes del sistema operativo (no hay garantía de que existan en el servidor).
const FONTS_DIR = join(process.cwd(), "assets", "fonts");
const FONT_REGULAR = join(FONTS_DIR, "Roboto-Regular.ttf");
const FONT_BOLD = join(FONTS_DIR, "Roboto-Medium.ttf");

// El encabezado va sobre fondo blanco con el logo centrado — el logoUrl que cada empresa carga en
// Gestión suele ser la versión blanca (pensada para el header oscuro del sitio público/panel), que
// ahí se ve invisible. Por eso usa siempre este archivo fijo (versión negra) en vez de
// proforma.empresa.logoUrl, sin importar qué empresa sea.
const LOGO_PATH = join(process.cwd(), "assets", "logos", "ethereal-scents-black.png");

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

    this.drawHeaderMinimal(doc, proforma, titulo);
    if (esVenta) {
      this.drawInfoBlockVenta(doc, proforma);
      const subtotal = this.drawTableMinimal(doc, proforma, esVenta, prefix);
      this.drawTotalesVenta(doc, proforma, prefix, subtotal);
      this.drawFooterVenta(doc);
    } else {
      this.drawInfoBlockCompra(doc, proforma);
      const subtotal = this.drawTableMinimal(doc, proforma, esVenta, prefix);
      this.drawTotalesCompra(doc, proforma, prefix, subtotal);
      this.drawFooterCompra(doc);
    }

    doc.end();
    return done;
  }

  private drawHeaderMinimal(doc: PDFKit.PDFDocument, proforma: Proforma, titulo: string) {
    const pageWidth = doc.page.width;
    let y = 16;

    const logoWidth = 76;
    const logoHeight = 19;
    if (existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, (pageWidth - logoWidth) / 2, y, { width: logoWidth, height: logoHeight, fit: [logoWidth, logoHeight] });
      } catch {
        // Best-effort: si el archivo no es una imagen válida, seguimos sin logo.
      }
    }
    y += logoHeight + 7;

    const ruleWidth = 26;
    doc
      .moveTo((pageWidth - ruleWidth) / 2, y)
      .lineTo((pageWidth + ruleWidth) / 2, y)
      .strokeColor(ES_GOLD)
      .lineWidth(1.3)
      .stroke();
    y += 9;

    doc.font("Roboto-Bold").fontSize(11).fillColor(ES_NAVY_900);
    doc.text(titulo.toUpperCase(), 0, y, { width: pageWidth, align: "center", characterSpacing: 1 });
    y += 13;

    doc.font("Roboto").fontSize(7).fillColor(ES_MUTED);
    doc.text(`N.° ${proforma.codigo}  ·  ${formatDate(proforma.fecha)}`, 0, y, { width: pageWidth, align: "center" });
    y += 12;

    doc.moveTo(PAGE_MARGIN, y).lineTo(pageWidth - PAGE_MARGIN, y).strokeColor(ES_LINE).lineWidth(0.75).stroke();
    y += 10;

    doc.fillColor("#000000");
    doc.y = y;
  }

  /** Cliente acotado a ciudad de entrega + teléfono (sin dirección ni email) — la segunda columna
   * ya no es "datos de la empresa", es la validez fija de la proforma (ver VALIDEZ_PROFORMA). */
  private drawInfoBlockVenta(doc: PDFKit.PDFDocument, proforma: Proforma) {
    const y = doc.y;
    const colWidth = (doc.page.width - PAGE_MARGIN * 2 - 16) / 2;
    const leftX = PAGE_MARGIN;
    const rightX = PAGE_MARGIN + colWidth + 16;

    doc.font("Roboto-Bold").fontSize(6.5).fillColor(ES_GOLD_INK);
    doc.text("CLIENTE", leftX, y, { characterSpacing: 0.5 });
    doc.text("VALIDEZ DE LA PROFORMA", rightX, y, { width: colWidth, characterSpacing: 0.5 });

    const cliente = proforma.cliente;
    const ciudad = proforma.ciudadEntrega?.nombre;
    const nombreYCiudad = [cliente?.nombre ?? "—", ciudad].filter(Boolean).join(" — ");

    doc.font("Roboto").fontSize(7.5).fillColor("#000000");
    let ly = y + 10;
    doc.text(nombreYCiudad, leftX, ly, { width: colWidth });
    ly += 10.5;
    if (cliente?.telefono) {
      doc.text(`Teléfono: ${cliente.telefono}`, leftX, ly, { width: colWidth });
      ly += 10.5;
    }

    doc.text(VALIDEZ_PROFORMA, rightX, y + 10, { width: colWidth });

    const bottom = ly + 6;
    doc.moveTo(PAGE_MARGIN, bottom).lineTo(doc.page.width - PAGE_MARGIN, bottom).strokeColor(ES_LINE).lineWidth(0.75).stroke();
    doc.fillColor("#000000");
    doc.y = bottom + 10;
  }

  /** Proveedor + país de procedencia (sin datos de la empresa, mismo criterio que Venta) — el tipo de
   * cambio no va acá, se muestra junto a la conversión a Bs en drawTotalesCompra. */
  private drawInfoBlockCompra(doc: PDFKit.PDFDocument, proforma: Proforma) {
    const y = doc.y;
    const colWidth = (doc.page.width - PAGE_MARGIN * 2 - 16) / 2;
    const leftX = PAGE_MARGIN;
    const rightX = PAGE_MARGIN + colWidth + 16;

    doc.font("Roboto-Bold").fontSize(6.5).fillColor(ES_GOLD_INK);
    doc.text("PROVEEDOR", leftX, y, { characterSpacing: 0.5 });
    doc.text("PAÍS DE PROCEDENCIA", rightX, y, { width: colWidth, characterSpacing: 0.5 });

    doc.font("Roboto").fontSize(7.5).fillColor("#000000");
    const ly = y + 10;
    doc.text(proforma.proveedor?.nombre ?? "—", leftX, ly, { width: colWidth });
    doc.text(proforma.paisProcedencia?.nombre ?? "—", rightX, ly, { width: colWidth });

    const bottom = ly + 10.5 + 6;
    doc.moveTo(PAGE_MARGIN, bottom).lineTo(doc.page.width - PAGE_MARGIN, bottom).strokeColor(ES_LINE).lineWidth(0.75).stroke();
    doc.fillColor("#000000");
    doc.y = bottom + 10;
  }

  /** Nunca corta una fila a la mitad (si no entra en lo que queda de página, pasa entera a la
   * siguiente, repitiendo el encabezado). precioUnitario sigue la misma fórmula que antes según el
   * tipo: en VENTA es el precio cargado en la línea; en COMPRA es compra + envío + seguridad +
   * logística (ver addDetalleCompra). */
  private drawTableMinimal(doc: PDFKit.PDFDocument, proforma: Proforma, esVenta: boolean, prefix: string): number {
    const left = PAGE_MARGIN;
    const width = doc.page.width - PAGE_MARGIN * 2;
    const colMarca = width * 0.16;
    const colConcepto = width * 0.36;
    const colCantidad = width * 0.12;
    const colPrecio = width * 0.16;
    const colTotal = width * 0.2;

    const drawTableHeader = (y: number) => {
      doc.font("Roboto-Bold").fontSize(6).fillColor(ES_NAVY_900);
      doc.text("MARCA", left, y, { width: colMarca });
      doc.text("CONCEPTO", left + colMarca, y, { width: colConcepto });
      doc.text("CANT.", left + colMarca + colConcepto, y, { width: colCantidad, align: "center" });
      doc.text("PRECIO", left + colMarca + colConcepto + colCantidad, y, { width: colPrecio, align: "right" });
      doc.text("TOTAL", left + colMarca + colConcepto + colCantidad + colPrecio, y, { width: colTotal, align: "right" });
      const headerBottom = y + 9;
      doc.moveTo(left, headerBottom).lineTo(left + width, headerBottom).strokeColor(ES_NAVY_900).lineWidth(1).stroke();
      doc.fillColor("#000000");
      return headerBottom + 6;
    };

    let y = drawTableHeader(doc.y);
    let subtotal = 0;

    for (const detalle of proforma.detalles) {
      const concepto = conceptoLabel(detalle);
      const marca = detalle.variante.product.brand?.name ?? "—";
      const precioUnitario = esVenta
        ? Number(detalle.precioUnitario ?? 0)
        : Number(detalle.precioCompra ?? 0) +
          Number(detalle.costoEnvio ?? 0) +
          Number(detalle.costoSeguridad ?? 0) +
          Number(detalle.costoLogistica ?? 0);
      const total = Number(detalle.subtotal);
      subtotal += total;

      doc.fontSize(7.5).font("Roboto");
      const rowHeight = Math.max(17, doc.heightOfString(concepto, { width: colConcepto }) + 9);

      if (y + rowHeight > CONTENT_BOTTOM) {
        doc.addPage();
        y = drawTableHeader(PAGE_MARGIN);
      }

      doc.font("Roboto").fillColor(ES_MUTED).text(marca, left, y + 3, { width: colMarca });
      doc.fillColor("#000000").text(concepto, left + colMarca, y + 3, { width: colConcepto });
      doc.text(String(detalle.cantidad), left + colMarca + colConcepto, y + 3, { width: colCantidad, align: "center" });
      doc.text(money(precioUnitario, prefix), left + colMarca + colConcepto + colCantidad, y + 3, { width: colPrecio, align: "right" });
      doc.font("Roboto-Bold").text(money(total, prefix), left + colMarca + colConcepto + colCantidad + colPrecio, y + 3, {
        width: colTotal,
        align: "right",
      });

      y += rowHeight;
      doc.moveTo(left, y).lineTo(left + width, y).strokeColor(ES_LINE).lineWidth(0.5).stroke();
    }

    doc.fillColor("#000000");
    doc.y = y + 10;
    return subtotal;
  }

  private drawTotalesVenta(doc: PDFKit.PDFDocument, proforma: Proforma, prefix: string, subtotal: number) {
    const boxWidth = 165;
    const left = doc.page.width - PAGE_MARGIN - boxWidth;
    const valueWidth = 70;
    const labelWidth = boxWidth - valueWidth;

    const descuento = Number(proforma.descuentoGeneral ?? 0);
    const total = subtotal - descuento;
    const porcentaje = Number(proforma.adelantoPorcentaje ?? 0);
    const tieneSaldoPendiente = Boolean(proforma.cuentaPorCobrar && proforma.cuentaPorCobrar.estado === "PENDIENTE");

    const blockHeight =
      11 /* subtotal */ +
      (descuento > 0 ? 11 : 0) +
      9 /* filete + aire */ +
      16 /* total */ +
      (porcentaje > 0 ? 22 : 0) +
      (tieneSaldoPendiente ? 11 : 0);

    let y = doc.y;
    if (y + blockHeight > CONTENT_BOTTOM) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    const line = (label: string, value: string, color: string) => {
      doc.font("Roboto").fontSize(7.5).fillColor(color);
      doc.text(label, left, y, { width: labelWidth });
      doc.text(value, left + labelWidth, y, { width: valueWidth, align: "right" });
      y += 11;
    };

    line("Subtotal", money(subtotal, prefix), ES_MUTED);
    if (descuento > 0) line("Descuento general", `-${money(descuento, prefix)}`, ES_SALE);

    doc.moveTo(left, y + 2).lineTo(left + boxWidth, y + 2).strokeColor(ES_NAVY_900).lineWidth(1).stroke();
    y += 7;

    doc.font("Roboto-Bold").fontSize(10.5).fillColor(ES_NAVY_900);
    doc.text("Total", left, y, { width: labelWidth });
    doc.text(money(total, prefix), left + labelWidth, y, { width: valueWidth, align: "right" });
    y += 16;

    if (porcentaje > 0) {
      const montoAdelanto = total * (porcentaje / 100);
      line(`Adelanto (${porcentaje}%)`, money(montoAdelanto, prefix), ES_MUTED);
      doc.font("Roboto-Bold").fontSize(7.5).fillColor(ES_NAVY_900);
      doc.text("Saldo", left, y, { width: labelWidth });
      doc.text(money(total - montoAdelanto, prefix), left + labelWidth, y, { width: valueWidth, align: "right" });
      y += 11;
    }

    if (tieneSaldoPendiente) {
      line("Saldo pendiente por cobrar", money(Number(proforma.cuentaPorCobrar!.montoAdeudado), prefix), ES_MUTED);
    }

    doc.fillColor("#000000");
    doc.y = y + 8;
  }

  /** Sin Subtotal separado (siempre es igual a Total — Compra no tiene descuento general) — solo
   * "Total" y, si se cargó tipo de cambio propio de la compra, su conversión a Bs debajo. */
  private drawTotalesCompra(doc: PDFKit.PDFDocument, proforma: Proforma, prefix: string, subtotal: number) {
    const boxWidth = 165;
    const left = doc.page.width - PAGE_MARGIN - boxWidth;
    const valueWidth = 70;
    const labelWidth = boxWidth - valueWidth;

    const tipoCambio = proforma.tipoCambioProf ? Number(proforma.tipoCambioProf) : null;
    const blockHeight = 16 /* total */ + (tipoCambio ? 22 : 0);

    let y = doc.y;
    if (y + blockHeight > CONTENT_BOTTOM) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    doc.font("Roboto-Bold").fontSize(10.5).fillColor(ES_NAVY_900);
    doc.text("Total", left, y, { width: labelWidth });
    doc.text(money(subtotal, prefix), left + labelWidth, y, { width: valueWidth, align: "right" });
    y += 16;

    if (tipoCambio) {
      doc.font("Roboto").fontSize(7.5).fillColor(ES_MUTED);
      doc.text("Tipo de cambio", left, y, { width: labelWidth });
      doc.text(tipoCambio.toFixed(4), left + labelWidth, y, { width: valueWidth, align: "right" });
      y += 11;

      doc.font("Roboto-Bold").fillColor(ES_NAVY_900);
      doc.text("Total Bs", left, y, { width: labelWidth });
      doc.text(money(subtotal * tipoCambio, "Bs"), left + labelWidth, y, { width: valueWidth, align: "right" });
      y += 11;
    }

    doc.fillColor("#000000");
    doc.y = y + 8;
  }

  /** Sin "Creado por"/fecha de generación (a pedido) — el paginado se mantiene. En su lugar, el
   * disclaimer de posibles retrasos de envío, igual en todas las páginas. */
  private drawFooterVenta(doc: PDFKit.PDFDocument) {
    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i++) {
      doc.switchToPage(pageRange.start + i);
      // Mismo motivo que en drawFooter: evita que pdfkit agregue una página en blanco de más.
      doc.page.margins.bottom = 0;
      const width = doc.page.width - PAGE_MARGIN * 2;
      const lineY = doc.page.height - 32;

      doc.moveTo(PAGE_MARGIN, lineY).lineTo(doc.page.width - PAGE_MARGIN, lineY).strokeColor(ES_LINE).lineWidth(0.5).stroke();

      doc.fontSize(6).font("Roboto").fillColor(ES_MUTED);
      doc.text(DISCLAIMER_ENTREGA, PAGE_MARGIN, lineY + 5, { width, align: "center" });
      doc.text(`Página ${i + 1} de ${pageRange.count}`, PAGE_MARGIN, lineY + 16, { width, align: "center" });

      doc.fillColor("#000000");
    }
  }

  /** Mismo pie que Venta pero sin el disclaimer de envío — está escrito desde la perspectiva de que
   * NOSOTROS le entregamos algo al lector, y acá es al revés (el proveedor nos entrega a nosotros). */
  private drawFooterCompra(doc: PDFKit.PDFDocument) {
    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i++) {
      doc.switchToPage(pageRange.start + i);
      doc.page.margins.bottom = 0;
      const width = doc.page.width - PAGE_MARGIN * 2;
      const lineY = doc.page.height - 32;

      doc.moveTo(PAGE_MARGIN, lineY).lineTo(doc.page.width - PAGE_MARGIN, lineY).strokeColor(ES_LINE).lineWidth(0.5).stroke();

      doc.fontSize(6).font("Roboto").fillColor(ES_MUTED);
      doc.text(`Página ${i + 1} de ${pageRange.count}`, PAGE_MARGIN, lineY + 8, { width, align: "center" });

      doc.fillColor("#000000");
    }
  }
}
