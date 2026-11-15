import { EstadoVariante, Prisma, TipoDescuentoCampana, UnidadVariante } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { computeBsPrices, computeCatalogPrice } from "../../catalog/product-price";

export type AlcanceCampana = { categoryId?: string; brandIds?: string[]; codigos?: string[] };
export type OpcionesCampana = { excluirConDescuento?: boolean; soloDisponibles?: boolean; margenMinimoPct?: number };

export type ParamsCalculo = {
  tipoDescuento: TipoDescuentoCampana;
  valor: number;
  alcance: AlcanceCampana;
  opciones: OpcionesCampana;
};

export type FilaCampana = {
  productId: string;
  /** Null = el descuento vive en el producto (catálogo simple); si no, en esta variante. */
  varianteId: string | null;
  codigo: string;
  marca: string | null;
  producto: string;
  etiqueta: string | null;
  /** Precio de lista (sin descuento), ya redondeado como lo ve el cliente. */
  precioLista: number;
  precioActual: number;
  descuentoActual: number;
  descuentoNuevo: number;
  precioNuevo: number;
  /** Margen sobre el costo (compra + logística + envío + seguridad) después del descuento; null si no hay costo. */
  margenPct: number | null;
  estado: "APLICA" | "AVISO" | "EXCLUIDO";
  motivo?: string;
};

/** Mismo redondeo que el catálogo: el Precio Final Bs siempre sube al múltiplo de 5. */
const aCinco = (n: number) => Math.ceil(n / 5) * 5;
const redondear2 = (n: number) => Math.round(n * 100) / 100;
const MARGEN_BAJO_PCT = 5;

/**
 * Calcula, producto por producto, el descuento que aplicaría una campaña (sin tocar nada). El descuento se guarda en `discountBs` (Bs por
 * unidad), así que se busca el monto que deja el Precio Final en el múltiplo de 5 objetivo. La unidad de descuento es la variante con precio
 * propio (las de decants en ml no entran: su precio sale de las presentaciones) o, si el producto no las tiene, el propio producto.
 */
export async function calcularCampana(
  prisma: PrismaService,
  params: ParamsCalculo,
  deps: { categoryIds?: string[]; exchangeRate: number },
): Promise<FilaCampana[]> {
  const { alcance, opciones } = params;
  const and: Prisma.ProductWhereInput[] = [];
  if (deps.categoryIds) and.push({ categoryId: { in: deps.categoryIds } });
  if (alcance.brandIds && alcance.brandIds.length > 0) and.push({ brandId: { in: alcance.brandIds } });
  if (alcance.codigos && alcance.codigos.length > 0) and.push({ productCode: { in: alcance.codigos, mode: "insensitive" } });

  const productos = await prisma.product.findMany({
    where: and.length > 0 ? { AND: and } : {},
    include: {
      brand: { select: { name: true } },
      category: { select: { logisticsCost: true, shippingCost: true, securityCost: true } },
      variants: { include: { options: { include: { optionValue: { select: { value: true } } } } } },
    },
    orderBy: { name: "asc" },
  });

  const tc = deps.exchangeRate;
  const filas: FilaCampana[] = [];

  for (const p of productos) {
    const conPrecioPropio = p.variants.filter((v) => !v.isDefault && v.unidad !== UnidadVariante.ML);
    const hayVariantesPropias = p.variants.some((v) => !v.isDefault);
    // Un producto cuyas únicas variantes con precio propio son de ml no tiene nada que rebajar.
    if (hayVariantesPropias && conPrecioPropio.length === 0) continue;

    const unidades = hayVariantesPropias
      ? conPrecioPropio.map((v) => ({
          varianteId: v.id as string | null,
          etiqueta: v.options.map((o) => o.optionValue.value).join(", ") || null,
          purchasePrice: v.purchasePrice,
          utility: v.utility,
          minPriceBs: v.minPriceBs,
          discountBs: v.discountBs,
          estado: v.estado,
        }))
      : [
          {
            varianteId: null as string | null,
            etiqueta: null as string | null,
            purchasePrice: p.purchasePrice,
            utility: p.utility,
            minPriceBs: p.minPriceBs,
            discountBs: p.discountBs,
            estado: p.variants.find((v) => v.isDefault)?.estado ?? EstadoVariante.DISPONIBLE,
          },
        ];

    for (const u of unidades) {
      const precioUsd = computeCatalogPrice(u.purchasePrice, u.utility, p.category);
      const lista = precioUsd * tc + Number(u.minPriceBs ?? 0) * tc;
      const precioLista = aCinco(lista);
      const descuentoActual = Number(u.discountBs);
      const precioActual = computeBsPrices(precioUsd, { minPriceBs: u.minPriceBs, discountBs: u.discountBs }, tc).finalPriceBs;
      const costoBs = (Number(u.purchasePrice) + Number(p.category.logisticsCost ?? 0) + Number(p.category.shippingCost ?? 0) + Number(p.category.securityCost ?? 0)) * tc;

      const base = {
        productId: p.id,
        varianteId: u.varianteId,
        codigo: p.productCode,
        marca: p.brand?.name ?? null,
        producto: p.name,
        etiqueta: u.etiqueta,
        precioLista,
        precioActual,
        descuentoActual,
        descuentoNuevo: descuentoActual,
        precioNuevo: precioActual,
        margenPct: precioActual > 0 && costoBs > 0 ? redondear2(((precioActual - costoBs) / precioActual) * 100) : null,
      };

      if (opciones.soloDisponibles && u.estado === EstadoVariante.NO_DISPONIBLE) {
        filas.push({ ...base, estado: "EXCLUIDO", motivo: "No disponible" });
        continue;
      }
      if (opciones.excluirConDescuento && descuentoActual > 0) {
        filas.push({ ...base, estado: "EXCLUIDO", motivo: "Ya tiene descuento propio: no se toca" });
        continue;
      }

      let objetivo = aCinco(params.tipoDescuento === TipoDescuentoCampana.PORCENTAJE ? lista * (1 - params.valor / 100) : lista - params.valor);
      let aviso: string | undefined;
      if (opciones.margenMinimoPct !== undefined && costoBs > 0) {
        const piso = aCinco(costoBs * (1 + opciones.margenMinimoPct / 100));
        if (objetivo < piso) {
          objetivo = piso;
          aviso = `El precio quedó en el piso de costo + ${opciones.margenMinimoPct}%`;
        }
      }
      if (objetivo >= precioLista) {
        filas.push({ ...base, estado: "EXCLUIDO", motivo: aviso ? "El piso de margen no deja espacio para descuento" : "El descuento no baja el precio" });
        continue;
      }

      // Redondeo hacia arriba a 2 decimales: así (lista − descuento) queda ≤ objetivo y el catálogo lo sube justo a ese múltiplo de 5.
      const descuentoNuevo = Math.ceil((lista - objetivo) * 100) / 100;
      const precioNuevo = computeBsPrices(precioUsd, { minPriceBs: u.minPriceBs, discountBs: new Prisma.Decimal(descuentoNuevo) }, tc).finalPriceBs;
      const margenPct = costoBs > 0 ? redondear2(((precioNuevo - costoBs) / precioNuevo) * 100) : null;
      const margenBajo = margenPct !== null && margenPct < MARGEN_BAJO_PCT;
      filas.push({
        ...base,
        descuentoNuevo,
        precioNuevo,
        margenPct,
        estado: aviso || margenBajo ? "AVISO" : "APLICA",
        motivo: aviso ?? (margenBajo ? `Margen bajo (${margenPct}%)` : undefined),
      });
    }
  }
  return filas;
}
