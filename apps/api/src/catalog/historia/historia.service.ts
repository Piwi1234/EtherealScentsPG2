import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { HistoriaCategoria, HistoriaSugerenciaTipo } from "@app/database";
import { slugify } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { deleteFromR2 } from "../../common/r2-storage";
import { CreateHistoriaDto } from "./dto/create-historia.dto";
import { UpdateHistoriaDto } from "./dto/update-historia.dto";
import { UpdateHistoriaBloqueDto } from "./dto/update-historia-bloque.dto";
import { UpdateHistoriaSugerenciaDto } from "./dto/update-historia-sugerencia.dto";

const SETTINGS_ID = "default";

const listInclude = {
  categorias: true,
  bloques: { where: { orden: 0 }, take: 1 },
} as const;

// Los productos de CASA/INGREDIENTE se resuelven en vivo del lado del cliente (vía
// /catalog/products?brandId=.../attr[...]=..., mismo endpoint que "Colección de la semana" y los
// filtros de /categoria) — acá solo se manda el id de la marca/acorde elegido, no una lista
// resuelta. sugerenciaProductos (tipo PERFUMES) sí es una selección manual, pero tampoco trae el
// Product completo: el cliente lo resuelve por id contra /catalog/products/:id, para no duplicar el
// armado de precios/variantes que ya hace browse.service.ts.
const detailInclude = {
  categorias: true,
  bloques: { orderBy: { orden: "asc" as const } },
  relacionadas: { include: { historiaB: { include: { categorias: true, bloques: { where: { orden: 0 }, take: 1 } } } } },
  sugerenciaBrand: { include: { categories: { include: { category: true } } } },
  sugerenciaAttributeOption: { include: { attribute: { include: { category: true } } } },
  sugerenciaProductos: { orderBy: { orden: "asc" as const }, select: { productId: true, orden: true } },
};

// PERFUMES y PERFUMISTA comparten el mismo mecanismo (lista manual vía sugerenciaProductos) — solo
// cambia el copy público ("Explora la Fragancia" vs "Explora sus Creaciones", ver
// HistoriaSugerenciaSection en el frontend). Ambos se tratan igual acá.
const TIPOS_CON_PRODUCTOS_MANUALES: HistoriaSugerenciaTipo[] = [
  HistoriaSugerenciaTipo.PERFUMES,
  HistoriaSugerenciaTipo.PERFUMISTA,
];

function mapCategorias(categorias: { categoria: HistoriaCategoria }[]): HistoriaCategoria[] {
  return categorias.map((c) => c.categoria);
}

/** CRUD de Historias (Gestión → Historias) y lo que alimenta /historias y /historias/[slug] en el
 * sitio público, más el bloque "Última historia" del home vía destacada (ver SystemSetting). */
@Injectable()
export class HistoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea la historia junto con su portada (bloque orden 0), vacía hasta que se completa desde el
   * formulario de edición — a diferencia de CarouselImage, acá no se obliga a cargar la imagen en el
   * mismo paso que el resto de los datos. */
  async create(dto: CreateHistoriaDto) {
    const last = await this.prisma.historia.findFirst({ orderBy: { orden: "desc" } });

    try {
      return await this.prisma.historia.create({
        data: {
          titulo: dto.titulo,
          slug: dto.slug ?? slugify(dto.titulo),
          orden: (last?.orden ?? -1) + 1,
          categorias: { create: dto.categorias.map((categoria) => ({ categoria })) },
          bloques: { create: [{ orden: 0 }] },
        },
        include: detailInclude,
      });
    } catch (error) {
      rethrowPrismaError(error, "Historia");
    }
  }

  /** Listado completo para Gestión (incluye borradores), ordenado por `orden` manual. */
  async findAllAdmin() {
    return this.prisma.historia.findMany({ orderBy: { orden: "asc" }, include: listInclude });
  }

  /** Listado público (solo publicadas) — mismo orden manual que el panel; filtrable por categoría y
   * por texto libre en el título. */
  async findAllPublic(options: { categoria?: HistoriaCategoria; search?: string } = {}) {
    return this.prisma.historia.findMany({
      where: {
        publicada: true,
        categorias: options.categoria ? { some: { categoria: options.categoria } } : undefined,
        titulo: options.search ? { contains: options.search, mode: "insensitive" } : undefined,
      },
      orderBy: { orden: "asc" },
      include: listInclude,
    });
  }

  async findOne(id: string) {
    const historia = await this.prisma.historia.findUnique({ where: { id }, include: detailInclude });
    if (!historia) {
      throw new NotFoundException("Historia no encontrada.");
    }
    return historia;
  }

  async findBySlug(slug: string) {
    const historia = await this.prisma.historia.findUnique({ where: { slug }, include: detailInclude });
    if (!historia || !historia.publicada) {
      throw new NotFoundException("Historia no encontrada.");
    }
    return historia;
  }

  /** La marcada a mano en SystemSetting.destacadaHistoriaId; sin ninguna marcada (o si la marcada ya
   * no está publicada), cae a la publicada más reciente. Null si no hay ninguna publicada. */
  async findDestacada() {
    const setting = await this.prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
    if (setting?.destacadaHistoriaId) {
      const marcada = await this.prisma.historia.findUnique({
        where: { id: setting.destacadaHistoriaId },
        include: detailInclude,
      });
      if (marcada && marcada.publicada) return marcada;
    }

    return this.prisma.historia.findFirst({
      where: { publicada: true },
      orderBy: { createdAt: "desc" },
      include: detailInclude,
    });
  }

  async setDestacada(id: string) {
    await this.findOne(id);
    await this.prisma.systemSetting.upsert({
      where: { id: SETTINGS_ID },
      update: { destacadaHistoriaId: id },
      create: { id: SETTINGS_ID, destacadaHistoriaId: id },
    });
  }

  async clearDestacada() {
    await this.prisma.systemSetting.updateMany({ where: { id: SETTINGS_ID }, data: { destacadaHistoriaId: null } });
  }

  async update(id: string, dto: UpdateHistoriaDto) {
    await this.findOne(id);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.categorias) {
          await tx.historiaCategoriaTag.deleteMany({ where: { historiaId: id } });
          if (dto.categorias.length > 0) {
            await tx.historiaCategoriaTag.createMany({
              data: dto.categorias.map((categoria) => ({ historiaId: id, categoria })),
            });
          }
        }

        return tx.historia.update({
          where: { id },
          data: { titulo: dto.titulo, slug: dto.slug, publicada: dto.publicada },
          include: detailInclude,
        });
      });
    } catch (error) {
      rethrowPrismaError(error, "Historia");
    }
  }

  async remove(id: string) {
    const historia = await this.findOne(id);
    try {
      await this.prisma.historia.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, "Historia");
    }

    // Best-effort: borra las imágenes de sus bloques para no acumular huérfanos en R2.
    await Promise.all(
      historia.bloques.flatMap((b) => [
        b.imageUrl ? deleteFromR2(b.imageUrl).catch(() => {}) : null,
        b.mobileImageUrl ? deleteFromR2(b.mobileImageUrl).catch(() => {}) : null,
      ]),
    );
  }

  /** Intercambia el `orden` con la historia vecina — no-op si ya está en la punta. */
  async move(id: string, direction: "up" | "down") {
    const current = await this.prisma.historia.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException("Historia no encontrada.");
    }

    const neighbor = await this.prisma.historia.findFirst({
      where: { orden: direction === "up" ? { lt: current.orden } : { gt: current.orden } },
      orderBy: { orden: direction === "up" ? "desc" : "asc" },
    });
    if (!neighbor) return;

    await this.prisma.$transaction([
      this.prisma.historia.update({ where: { id: current.id }, data: { orden: neighbor.orden } }),
      this.prisma.historia.update({ where: { id: neighbor.id }, data: { orden: current.orden } }),
    ]);
  }

  // ---------------------------------------------------------------------------------------------
  // Bloques
  // ---------------------------------------------------------------------------------------------

  private async assertHistoriaExists(historiaId: string) {
    const exists = await this.prisma.historia.findUnique({ where: { id: historiaId }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException("Historia no encontrada.");
    }
  }

  async addBloque(historiaId: string, dto: UpdateHistoriaBloqueDto) {
    await this.assertHistoriaExists(historiaId);
    const last = await this.prisma.historiaBloque.findFirst({ where: { historiaId }, orderBy: { orden: "desc" } });

    return this.prisma.historiaBloque.create({
      data: { historiaId, orden: (last?.orden ?? 0) + 1, ...dto },
    });
  }

  private async findBloque(historiaId: string, bloqueId: string) {
    const bloque = await this.prisma.historiaBloque.findUnique({ where: { id: bloqueId } });
    if (!bloque || bloque.historiaId !== historiaId) {
      throw new NotFoundException("Bloque no encontrado.");
    }
    return bloque;
  }

  async updateBloque(historiaId: string, bloqueId: string, dto: UpdateHistoriaBloqueDto) {
    await this.findBloque(historiaId, bloqueId);
    return this.prisma.historiaBloque.update({ where: { id: bloqueId }, data: dto });
  }

  /** No se puede eliminar la portada (orden 0) — solo los bloques agregados a mano. */
  async removeBloque(historiaId: string, bloqueId: string) {
    const bloque = await this.findBloque(historiaId, bloqueId);
    if (bloque.orden === 0) {
      throw new BadRequestException("La página principal no se puede eliminar.");
    }

    await this.prisma.historiaBloque.delete({ where: { id: bloqueId } });

    if (bloque.imageUrl) await deleteFromR2(bloque.imageUrl).catch(() => {});
    if (bloque.mobileImageUrl) await deleteFromR2(bloque.mobileImageUrl).catch(() => {});
  }

  /** Intercambia el `orden` con el bloque vecino — la portada (orden 0) nunca entra en el swap, ni
   * como origen ni como vecino, así que siempre se queda primera. */
  async moveBloque(historiaId: string, bloqueId: string, direction: "up" | "down") {
    const current = await this.findBloque(historiaId, bloqueId);
    if (current.orden === 0) {
      throw new BadRequestException("La página principal no se puede reordenar.");
    }

    const neighbor = await this.prisma.historiaBloque.findFirst({
      where: {
        historiaId,
        orden: direction === "up" ? { lt: current.orden, gt: 0 } : { gt: current.orden },
      },
      orderBy: { orden: direction === "up" ? "desc" : "asc" },
    });
    if (!neighbor) return;

    await this.prisma.$transaction([
      this.prisma.historiaBloque.update({ where: { id: current.id }, data: { orden: neighbor.orden } }),
      this.prisma.historiaBloque.update({ where: { id: neighbor.id }, data: { orden: current.orden } }),
    ]);
  }

  async setBloqueImage(historiaId: string, bloqueId: string, file: Express.Multer.File) {
    const existing = await this.findBloque(historiaId, bloqueId);
    // file.filename ya es la URL pública completa de R2 (ver WebpUploadInterceptor).
    const updated = await this.prisma.historiaBloque.update({ where: { id: bloqueId }, data: { imageUrl: file.filename } });

    if (existing.imageUrl) await deleteFromR2(existing.imageUrl).catch(() => {});
    return updated;
  }

  async setBloqueMobileImage(historiaId: string, bloqueId: string, file: Express.Multer.File) {
    const existing = await this.findBloque(historiaId, bloqueId);
    const updated = await this.prisma.historiaBloque.update({
      where: { id: bloqueId },
      data: { mobileImageUrl: file.filename },
    });

    if (existing.mobileImageUrl) await deleteFromR2(existing.mobileImageUrl).catch(() => {});
    return updated;
  }

  async removeBloqueMobileImage(historiaId: string, bloqueId: string) {
    const existing = await this.findBloque(historiaId, bloqueId);
    const updated = await this.prisma.historiaBloque.update({ where: { id: bloqueId }, data: { mobileImageUrl: null } });

    if (existing.mobileImageUrl) await deleteFromR2(existing.mobileImageUrl).catch(() => {});
    return updated;
  }

  // ---------------------------------------------------------------------------------------------
  // Relacionadas
  // ---------------------------------------------------------------------------------------------

  /** Vínculo manual y recíproco: crea las 2 filas (A→B y B→A) en una transacción. No-op si ya
   * existía el vínculo. */
  async addRelacionada(historiaId: string, relacionadaId: string) {
    if (historiaId === relacionadaId) {
      throw new BadRequestException("Una historia no puede relacionarse consigo misma.");
    }
    await this.assertHistoriaExists(historiaId);
    await this.assertHistoriaExists(relacionadaId);

    await this.prisma.$transaction([
      this.prisma.historiaRelacionada.upsert({
        where: { historiaAId_historiaBId: { historiaAId: historiaId, historiaBId: relacionadaId } },
        update: {},
        create: { historiaAId: historiaId, historiaBId: relacionadaId },
      }),
      this.prisma.historiaRelacionada.upsert({
        where: { historiaAId_historiaBId: { historiaAId: relacionadaId, historiaBId: historiaId } },
        update: {},
        create: { historiaAId: relacionadaId, historiaBId: historiaId },
      }),
    ]);
  }

  async removeRelacionada(historiaId: string, relacionadaId: string) {
    await this.prisma.historiaRelacionada.deleteMany({
      where: {
        OR: [
          { historiaAId: historiaId, historiaBId: relacionadaId },
          { historiaAId: relacionadaId, historiaBId: historiaId },
        ],
      },
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Sugerencia al final de la historia ("Explora la casa/fragancia/los aromas...")
  // ---------------------------------------------------------------------------------------------

  /** Cambia qué alimenta el bloque de sugerencia — CASA e INGREDIENTE solo guardan el id elegido (el
   * cliente resuelve los productos en vivo, ver detailInclude); null limpia todo, incluida la lista
   * manual de PERFUMES/PERFUMISTA, que no tiene sentido conservar si se cambia a otro tipo. */
  async setSugerencia(historiaId: string, dto: UpdateHistoriaSugerenciaDto) {
    await this.assertHistoriaExists(historiaId);

    if (dto.tipo === HistoriaSugerenciaTipo.CASA) {
      if (!dto.brandId) {
        throw new BadRequestException("Elegí una marca para la sugerencia de tipo Casa.");
      }
      const brand = await this.prisma.brand.findUnique({ where: { id: dto.brandId } });
      if (!brand) {
        throw new NotFoundException("Marca no encontrada.");
      }
    } else if (dto.tipo === HistoriaSugerenciaTipo.INGREDIENTE) {
      if (!dto.attributeOptionId) {
        throw new BadRequestException("Elegí un acorde para la sugerencia de tipo Ingrediente.");
      }
      const option = await this.prisma.attributeOption.findUnique({ where: { id: dto.attributeOptionId } });
      if (!option) {
        throw new NotFoundException("Acorde no encontrado.");
      }
    }

    if (!dto.tipo || !TIPOS_CON_PRODUCTOS_MANUALES.includes(dto.tipo)) {
      await this.prisma.historiaSugerenciaProducto.deleteMany({ where: { historiaId } });
    }

    return this.prisma.historia.update({
      where: { id: historiaId },
      data: {
        sugerenciaTipo: dto.tipo ?? null,
        sugerenciaBrandId: dto.tipo === HistoriaSugerenciaTipo.CASA ? dto.brandId : null,
        sugerenciaAttributeOptionId: dto.tipo === HistoriaSugerenciaTipo.INGREDIENTE ? dto.attributeOptionId : null,
      },
      include: detailInclude,
    });
  }

  private async assertSugerenciaTipoConProductosManuales(historiaId: string) {
    const historia = await this.prisma.historia.findUnique({ where: { id: historiaId }, select: { sugerenciaTipo: true } });
    if (!historia || !historia.sugerenciaTipo || !TIPOS_CON_PRODUCTOS_MANUALES.includes(historia.sugerenciaTipo)) {
      throw new BadRequestException("Primero elegí \"Perfumes\" o \"Perfumista\" como tipo de sugerencia.");
    }
  }

  async addSugerenciaProducto(historiaId: string, productId: string) {
    await this.assertSugerenciaTipoConProductosManuales(historiaId);

    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) {
      throw new NotFoundException("Producto no encontrado.");
    }

    const last = await this.prisma.historiaSugerenciaProducto.findFirst({ where: { historiaId }, orderBy: { orden: "desc" } });
    await this.prisma.historiaSugerenciaProducto.upsert({
      where: { historiaId_productId: { historiaId, productId } },
      update: {},
      create: { historiaId, productId, orden: (last?.orden ?? -1) + 1 },
    });
  }

  async removeSugerenciaProducto(historiaId: string, productId: string) {
    await this.prisma.historiaSugerenciaProducto.deleteMany({ where: { historiaId, productId } });
  }

  /** Intercambia el `orden` con el vecino — mismo criterio que el resto de las listas ordenables. */
  async moveSugerenciaProducto(historiaId: string, productId: string, direction: "up" | "down") {
    const current = await this.prisma.historiaSugerenciaProducto.findUnique({
      where: { historiaId_productId: { historiaId, productId } },
    });
    if (!current) {
      throw new NotFoundException("Ese producto no está en la sugerencia de esta historia.");
    }

    const neighbor = await this.prisma.historiaSugerenciaProducto.findFirst({
      where: { historiaId, orden: direction === "up" ? { lt: current.orden } : { gt: current.orden } },
      orderBy: { orden: direction === "up" ? "desc" : "asc" },
    });
    if (!neighbor) return;

    await this.prisma.$transaction([
      this.prisma.historiaSugerenciaProducto.update({
        where: { historiaId_productId: { historiaId, productId: current.productId } },
        data: { orden: neighbor.orden },
      }),
      this.prisma.historiaSugerenciaProducto.update({
        where: { historiaId_productId: { historiaId, productId: neighbor.productId } },
        data: { orden: current.orden },
      }),
    ]);
  }
}
