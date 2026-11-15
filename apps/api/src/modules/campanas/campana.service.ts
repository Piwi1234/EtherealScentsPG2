import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EstadoCampana, Prisma, TipoDescuentoCampana } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { CategoryService } from "../../catalog/category/category.service";
import { SettingsService } from "../../settings/settings.service";
import { AlcanceCampana, calcularCampana, FilaCampana, OpcionesCampana, ParamsCalculo } from "./campana-calculo";
import { CrearCampanaDto, VistaPreviaCampanaDto } from "./dto/campana.dto";

const LOTE = 25;
const redondear1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Campañas de descuento masivo (Black Friday, etc.). Empiezan y terminan solas: un barrido (cada minuto y, con un tope de 30 segundos,
 * antes de cada lectura del catálogo público) aplica las PROGRAMADAS cuyo inicio llegó y restaura las que ya pasaron su fin. Aplicar =
 * poner el descuento calculado en `discountBs` de cada producto o variante, guardando el anterior; restaurar = devolverlo, solo si nadie
 * lo cambió a mano mientras tanto.
 */
@Injectable()
export class CampanaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampanaService.name);
  private timer?: NodeJS.Timeout;
  private ultimaSync = 0;
  private enCurso: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoryService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit() {
    void this.sincronizar(true);
    this.timer = setInterval(() => void this.sincronizar(true), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // --- Barrido de estados ---

  /** Aplica las campañas que ya empezaron y restaura las que ya terminaron. Con `forzar` ignora el tope de 30 segundos. */
  async sincronizar(forzar = false): Promise<void> {
    if (this.enCurso) return this.enCurso;
    if (!forzar && Date.now() - this.ultimaSync < 30_000) return;
    this.enCurso = (async () => {
      try {
        const ahora = new Date();
        const pendientes = await this.prisma.campana.findMany({ where: { estado: { in: [EstadoCampana.PROGRAMADA, EstadoCampana.ACTIVA] } } });
        for (const c of pendientes) {
          if (c.fin <= ahora) await this.finalizar(c.id, EstadoCampana.TERMINADA);
          else if (c.estado === EstadoCampana.PROGRAMADA && c.inicio <= ahora) await this.activar(c.id);
        }
      } catch (error) {
        this.logger.error(`No se pudo sincronizar las campañas: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        this.ultimaSync = Date.now();
        this.enCurso = null;
      }
    })();
    return this.enCurso;
  }

  // --- Cálculo ---

  private normalizar(dto: VistaPreviaCampanaDto): ParamsCalculo {
    const codigos = (dto.alcance?.codigos ?? []).map((c) => c.trim()).filter(Boolean);
    return {
      tipoDescuento: dto.tipoDescuento,
      valor: dto.valor ?? 0,
      alcance: { categoryId: dto.alcance?.categoryId, brandIds: dto.alcance?.brandIds ?? [], codigos },
      opciones: { excluirConDescuento: dto.opciones?.excluirConDescuento ?? true, soloDisponibles: dto.opciones?.soloDisponibles ?? true, margenMinimoPct: dto.opciones?.margenMinimoPct },
    };
  }

  private validarDescuento(p: ParamsCalculo) {
    if (p.tipoDescuento === TipoDescuentoCampana.NINGUNO) return;
    if (!(p.valor > 0)) throw new BadRequestException("Indica el valor del descuento.");
    if (p.tipoDescuento === TipoDescuentoCampana.PORCENTAJE && p.valor > 90) throw new BadRequestException("El porcentaje no puede pasar de 90.");
    const a = p.alcance;
    if (!a.categoryId && (a.brandIds?.length ?? 0) === 0 && (a.codigos?.length ?? 0) === 0) {
      throw new BadRequestException("Elige a qué productos se aplica: una categoría, una marca o una lista de códigos.");
    }
  }

  private async calcular(p: ParamsCalculo): Promise<FilaCampana[]> {
    const categoryIds = p.alcance.categoryId ? await this.categories.getDescendantIds(p.alcance.categoryId) : undefined;
    return calcularCampana(this.prisma, p, { categoryIds, exchangeRate: await this.settings.getExchangeRate() });
  }

  /** Lo que haría la campaña, sin aplicarla: resumen y las primeras filas (los avisos primero). */
  async vistaPrevia(dto: VistaPreviaCampanaDto, limite = 100) {
    const p = this.normalizar(dto);
    if (p.tipoDescuento === TipoDescuentoCampana.NINGUNO) {
      return { resumen: { afectados: 0, avisos: 0, excluidos: 0, descuentoPromedioPct: null, margenPromedioPct: null }, filas: [] as FilaCampana[], total: 0 };
    }
    this.validarDescuento(p);
    const filas = await this.calcular(p);
    const afectadas = filas.filter((f) => f.estado !== "EXCLUIDO");
    const media = (xs: number[]) => (xs.length > 0 ? redondear1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    const orden = { AVISO: 0, APLICA: 1, EXCLUIDO: 2 } as const;
    return {
      resumen: {
        afectados: afectadas.length,
        avisos: filas.filter((f) => f.estado === "AVISO").length,
        excluidos: filas.filter((f) => f.estado === "EXCLUIDO").length,
        descuentoPromedioPct: media(afectadas.filter((f) => f.precioLista > 0).map((f) => ((f.precioLista - f.precioNuevo) / f.precioLista) * 100)),
        margenPromedioPct: media(afectadas.map((f) => f.margenPct).filter((m): m is number => m !== null)),
      },
      filas: [...filas].sort((a, b) => orden[a.estado] - orden[b.estado]).slice(0, limite),
      total: filas.length,
    };
  }

  // --- Altas y cambios ---

  private validarFechas(inicio: Date, fin: Date) {
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) throw new BadRequestException("Fechas inválidas.");
    if (fin <= inicio) throw new BadRequestException("El fin tiene que ser posterior al inicio.");
  }

  /** Dos campañas con descuento no pueden solaparse: pisarían los descuentos una de la otra. */
  private async assertSinSolape(inicio: Date, fin: Date, excluirId?: string) {
    const choque = await this.prisma.campana.findFirst({
      where: {
        id: excluirId ? { not: excluirId } : undefined,
        tipoDescuento: { not: TipoDescuentoCampana.NINGUNO },
        estado: { in: [EstadoCampana.PROGRAMADA, EstadoCampana.ACTIVA] },
        inicio: { lt: fin },
        fin: { gt: inicio },
      },
    });
    if (choque) throw new ConflictException(`Se solapa con la campaña «${choque.nombre}» (descuentos). Cambia las fechas o revierte la otra.`);
  }

  async crear(dto: CrearCampanaDto, usuarioId: string) {
    const p = this.normalizar(dto);
    this.validarDescuento(p);
    const inicio = new Date(dto.inicio);
    const fin = new Date(dto.fin);
    this.validarFechas(inicio, fin);
    if (p.tipoDescuento !== TipoDescuentoCampana.NINGUNO) await this.assertSinSolape(inicio, fin);
    const c = await this.prisma.campana.create({
      data: {
        nombre: dto.nombre.trim(),
        inicio,
        fin,
        tipoDescuento: p.tipoDescuento,
        valor: p.tipoDescuento === TipoDescuentoCampana.NINGUNO ? null : p.valor,
        alcance: p.alcance as Prisma.InputJsonValue,
        opciones: p.opciones as Prisma.InputJsonValue,
        creadoPorId: usuarioId,
      },
    });
    return dto.programar ? this.programar(c.id) : this.findOne(c.id);
  }

  async actualizar(id: string, dto: CrearCampanaDto) {
    const c = await this.getOrFail(id);
    if (c.estado !== EstadoCampana.BORRADOR) throw new ConflictException("Solo se edita una campaña en borrador.");
    const p = this.normalizar(dto);
    this.validarDescuento(p);
    const inicio = new Date(dto.inicio);
    const fin = new Date(dto.fin);
    this.validarFechas(inicio, fin);
    await this.prisma.campana.update({
      where: { id },
      data: {
        nombre: dto.nombre.trim(),
        inicio,
        fin,
        tipoDescuento: p.tipoDescuento,
        valor: p.tipoDescuento === TipoDescuentoCampana.NINGUNO ? null : p.valor,
        alcance: p.alcance as Prisma.InputJsonValue,
        opciones: p.opciones as Prisma.InputJsonValue,
      },
    });
    return dto.programar ? this.programar(id) : this.findOne(id);
  }

  async programar(id: string) {
    const c = await this.getOrFail(id);
    if (c.estado !== EstadoCampana.BORRADOR) throw new ConflictException(`La campaña está ${c.estado}.`);
    if (c.fin <= new Date()) throw new BadRequestException("El fin ya pasó: cambia las fechas.");
    if (c.tipoDescuento !== TipoDescuentoCampana.NINGUNO) await this.assertSinSolape(c.inicio, c.fin, id);
    await this.prisma.campana.update({ where: { id }, data: { estado: EstadoCampana.PROGRAMADA } });
    await this.sincronizar(true);
    return this.findOne(id);
  }

  async revertir(id: string) {
    const c = await this.getOrFail(id);
    if (c.estado !== EstadoCampana.ACTIVA && c.estado !== EstadoCampana.PROGRAMADA) throw new ConflictException(`La campaña está ${c.estado}: no hay nada que revertir.`);
    await this.finalizar(id, EstadoCampana.REVERTIDA);
    return this.findOne(id);
  }

  async eliminar(id: string) {
    const c = await this.getOrFail(id);
    if (c.estado !== EstadoCampana.BORRADOR) throw new ConflictException("Solo se elimina una campaña en borrador.");
    await this.prisma.campana.delete({ where: { id } });
  }

  // --- Consultas ---

  private async getOrFail(id: string) {
    const c = await this.prisma.campana.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Campaña no encontrada.");
    return c;
  }

  async list() {
    await this.sincronizar();
    const campanas = await this.prisma.campana.findMany({ orderBy: { inicio: "desc" }, include: { _count: { select: { items: true } } } });
    return campanas.map(({ _count, ...c }) => ({ ...c, productos: _count.items }));
  }

  async findOne(id: string) {
    const c = await this.prisma.campana.findUnique({ where: { id }, include: { _count: { select: { items: true } } } });
    if (!c) throw new NotFoundException("Campaña no encontrada.");
    const { _count, ...resto } = c;
    return { ...resto, productos: _count.items };
  }

  /** Para la tienda: la campaña activa ahora mismo (nombre y fechas), o `{ activa: false }`. */
  async activaPublica() {
    await this.sincronizar();
    const ahora = new Date();
    const c = await this.prisma.campana.findFirst({
      where: { estado: EstadoCampana.ACTIVA, inicio: { lte: ahora }, fin: { gt: ahora } },
      orderBy: { fin: "asc" },
      select: { nombre: true, inicio: true, fin: true },
    });
    return c ? { activa: true as const, ...c } : { activa: false as const };
  }

  // --- Aplicar y restaurar ---

  private async activar(id: string) {
    const c = await this.getOrFail(id);
    if (c.estado !== EstadoCampana.PROGRAMADA) return;
    const filas =
      c.tipoDescuento === TipoDescuentoCampana.NINGUNO
        ? []
        : (
            await this.calcular({
              tipoDescuento: c.tipoDescuento,
              valor: Number(c.valor ?? 0),
              alcance: c.alcance as AlcanceCampana,
              opciones: c.opciones as OpcionesCampana,
            })
          ).filter((f) => f.estado !== "EXCLUIDO");

    await this.prisma.$transaction(
      async (tx) => {
        // Si otro barrido ya la activó, no se repite.
        const tomada = await tx.campana.updateMany({ where: { id, estado: EstadoCampana.PROGRAMADA }, data: { estado: EstadoCampana.ACTIVA, aplicadaAt: new Date() } });
        if (tomada.count === 0) return;
        for (let i = 0; i < filas.length; i += LOTE) {
          await Promise.all(
            filas.slice(i, i + LOTE).map((f) =>
              f.varianteId
                ? tx.productVariant.update({ where: { id: f.varianteId }, data: { discountBs: f.descuentoNuevo } })
                : tx.product.update({ where: { id: f.productId }, data: { discountBs: f.descuentoNuevo } }),
            ),
          );
        }
        if (filas.length > 0) {
          await tx.campanaItem.createMany({
            data: filas.map((f) => ({ campanaId: id, productId: f.productId, varianteId: f.varianteId, descuentoAnterior: f.descuentoActual, descuentoNuevo: f.descuentoNuevo })),
          });
        }
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    this.logger.log(`Campaña «${c.nombre}» activada: ${filas.length} producto(s)/variante(s) con descuento.`);
  }

  private async finalizar(id: string, estadoFinal: typeof EstadoCampana.TERMINADA | typeof EstadoCampana.REVERTIDA) {
    const c = await this.getOrFail(id);
    const items = await this.prisma.campanaItem.findMany({ where: { campanaId: id } });
    await this.prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < items.length; i += LOTE) {
          await Promise.all(
            items.slice(i, i + LOTE).map((it) =>
              // Solo se restaura si el descuento sigue siendo el de la campaña: si alguien lo cambió a mano, se respeta.
              it.varianteId
                ? tx.productVariant.updateMany({ where: { id: it.varianteId, discountBs: it.descuentoNuevo }, data: { discountBs: it.descuentoAnterior } })
                : tx.product.updateMany({ where: { id: it.productId, discountBs: it.descuentoNuevo }, data: { discountBs: it.descuentoAnterior } }),
            ),
          );
        }
        await tx.campana.update({ where: { id }, data: { estado: estadoFinal, terminadaAt: new Date() } });
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    this.logger.log(`Campaña «${c.nombre}» ${estadoFinal === EstadoCampana.TERMINADA ? "terminada" : "revertida"}: ${items.length} precio(s) restaurado(s).`);
  }
}
