import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoProforma, Prisma, TipoProforma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { SettingsService } from "../../settings/settings.service";
import { computeBsPrices, computeCatalogPrice } from "../../catalog/product-price";
import { ProformaHistorialService } from "./proforma-historial.service";
import { CreateProformaDto } from "./dto/create-proforma.dto";
import { UpdateProformaDto } from "./dto/update-proforma.dto";
import { QueryProformaDto } from "./dto/query-proforma.dto";
import { AddDetalleVentaDto } from "./dto/add-detalle-venta.dto";
import { AddDetalleCompraDto } from "./dto/add-detalle-compra.dto";
import { UpdateDetalleDto } from "./dto/update-detalle.dto";

export const includeDetails = {
  empresa: true,
  cliente: true,
  almacenRecepcion: { include: { ciudad: true } },
  ciudadEntrega: true,
  creadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
  detalles: {
    include: {
      variante: { include: { product: true } },
      asignaciones: { include: { almacen: true } },
      loteCompra: true,
      seguimientos: { orderBy: { fecha: "desc" as const } },
    },
  },
  historial: {
    orderBy: { fecha: "desc" as const },
    include: { usuario: { select: { id: true, nombre: true } } },
  },
} satisfies Prisma.ProformaInclude;

/**
 * CRUD y queries de proformas — sin locking ni efectos de stock. Las transiciones que tocan Stock
 * (aprobar VENTA, rechazar/anular desde APROBADA, completar) viven en proforma-approval.service.ts y
 * proforma-completion.service.ts.
 */
@Injectable()
export class ProformasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly historial: ProformaHistorialService,
  ) {}

  async findAll(query: QueryProformaDto) {
    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });
    const where: Prisma.ProformaWhereInput = {
      tipo: query.tipo,
      estado: query.estado,
      empresaId: query.empresaId,
    };
    const [items, total] = await Promise.all([
      this.prisma.proforma.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: includeDetails }),
      this.prisma.proforma.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const proforma = await this.prisma.proforma.findUnique({ where: { id }, include: includeDetails });
    if (!proforma) {
      throw new NotFoundException("Proforma no encontrada.");
    }
    return proforma;
  }

  private assertBorrador(proforma: { estado: EstadoProforma }) {
    if (proforma.estado !== EstadoProforma.BORRADOR) {
      throw new ConflictException("Esta proforma ya no está en BORRADOR: el detalle no es editable.");
    }
  }

  private async assertEmpresaExists(id: string) {
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa) throw new BadRequestException(`empresaId inválido: ${id}`);
  }

  private async assertClienteExists(id: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new BadRequestException(`clienteId inválido: ${id}`);
  }

  private async assertAlmacenExists(id: string) {
    const almacen = await this.prisma.almacen.findUnique({ where: { id } });
    if (!almacen) throw new BadRequestException(`almacenRecepcionId inválido: ${id}`);
  }

  private async assertCiudadExists(id: string) {
    const ciudad = await this.prisma.ciudad.findUnique({ where: { id } });
    if (!ciudad) throw new BadRequestException(`ciudadEntregaId inválido: ${id}`);
  }

  private async getVarianteParaPrecio(varianteId: string) {
    const variante = await this.prisma.productVariant.findUnique({
      where: { id: varianteId },
      include: { product: { include: { category: true } } },
    });
    if (!variante) {
      throw new BadRequestException(`varianteId inválido: ${varianteId}`);
    }
    return variante;
  }

  private async computePrecioFinalBs(variante: Awaited<ReturnType<typeof this.getVarianteParaPrecio>>): Promise<number> {
    const exchangeRate = await this.settings.getExchangeRate();
    const priceUsd = computeCatalogPrice(variante.purchasePrice, variante.utility, variante.product.category);
    return computeBsPrices(priceUsd, variante, exchangeRate).finalPriceBs;
  }

  async create(dto: CreateProformaDto, creadoPorId: string) {
    await this.assertEmpresaExists(dto.empresaId);

    if (dto.tipo === TipoProforma.VENTA) {
      if (!dto.clienteId) throw new BadRequestException("clienteId es obligatorio para una proforma de venta.");
      if (dto.almacenRecepcionId) throw new BadRequestException("almacenRecepcionId no aplica a una proforma de venta.");
      await this.assertClienteExists(dto.clienteId);
      if (dto.ciudadEntregaId) await this.assertCiudadExists(dto.ciudadEntregaId);
    } else {
      if (!dto.almacenRecepcionId) throw new BadRequestException("almacenRecepcionId es obligatorio para una proforma de compra.");
      if (dto.clienteId) throw new BadRequestException("clienteId no aplica a una proforma de compra.");
      if (dto.ciudadEntregaId) throw new BadRequestException("ciudadEntregaId no aplica a una proforma de compra.");
      await this.assertAlmacenExists(dto.almacenRecepcionId);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const proforma = await tx.proforma.create({
          data: {
            tipo: dto.tipo,
            empresaId: dto.empresaId,
            clienteId: dto.tipo === TipoProforma.VENTA ? dto.clienteId : undefined,
            almacenRecepcionId: dto.tipo === TipoProforma.COMPRA ? dto.almacenRecepcionId : undefined,
            ciudadEntregaId: dto.tipo === TipoProforma.VENTA ? dto.ciudadEntregaId : undefined,
            creadoPorId,
            descuentoGeneral: dto.descuentoGeneral ?? 0,
            montoAdelanto: dto.montoAdelanto,
          },
        });
        await this.historial.registrar(tx, proforma.id, EstadoProforma.BORRADOR, creadoPorId, "Proforma creada.");
        return tx.proforma.findUniqueOrThrow({ where: { id: proforma.id }, include: includeDetails });
      });
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
  }

  async update(id: string, dto: UpdateProformaDto) {
    const existing = await this.findOne(id);
    this.assertBorrador(existing);

    if (existing.tipo === TipoProforma.VENTA) {
      if (dto.almacenRecepcionId !== undefined) {
        throw new BadRequestException("almacenRecepcionId no aplica a una proforma de venta.");
      }
      if (dto.clienteId) await this.assertClienteExists(dto.clienteId);
      if (dto.ciudadEntregaId) await this.assertCiudadExists(dto.ciudadEntregaId);
    } else {
      if (dto.clienteId !== undefined) {
        throw new BadRequestException("clienteId no aplica a una proforma de compra.");
      }
      if (dto.ciudadEntregaId !== undefined) {
        throw new BadRequestException("ciudadEntregaId no aplica a una proforma de compra.");
      }
      if (dto.almacenRecepcionId) await this.assertAlmacenExists(dto.almacenRecepcionId);
    }
    if (dto.empresaId) await this.assertEmpresaExists(dto.empresaId);

    try {
      await this.prisma.proforma.update({ where: { id }, data: dto });
      return this.findOne(id);
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
  }

  async addDetalleVenta(id: string, dto: AddDetalleVentaDto) {
    const proforma = await this.findOne(id);
    this.assertBorrador(proforma);
    if (proforma.tipo !== TipoProforma.VENTA) {
      throw new BadRequestException("Esta proforma no es de venta.");
    }

    const variante = await this.getVarianteParaPrecio(dto.varianteId);
    const precioUnitario = dto.precioUnitario ?? (await this.computePrecioFinalBs(variante));
    const subtotal = dto.cantidad * precioUnitario;

    try {
      await this.prisma.proformaDetalle.create({
        data: { proformaId: id, varianteId: dto.varianteId, cantidad: dto.cantidad, precioUnitario, subtotal },
      });
      return this.findOne(id);
    } catch (error) {
      rethrowPrismaError(error, "Línea de proforma");
    }
  }

  async addDetalleCompra(id: string, dto: AddDetalleCompraDto) {
    const proforma = await this.findOne(id);
    this.assertBorrador(proforma);
    if (proforma.tipo !== TipoProforma.COMPRA) {
      throw new BadRequestException("Esta proforma no es de compra.");
    }
    await this.getVarianteParaPrecio(dto.varianteId);

    const costoUnitario = dto.precioCompra + dto.costoEnvio + dto.costoSeguridad + dto.costoLogistica;
    const subtotal = dto.cantidad * costoUnitario;

    try {
      await this.prisma.proformaDetalle.create({
        data: {
          proformaId: id,
          varianteId: dto.varianteId,
          cantidad: dto.cantidad,
          precioCompra: dto.precioCompra,
          costoEnvio: dto.costoEnvio,
          costoSeguridad: dto.costoSeguridad,
          costoLogistica: dto.costoLogistica,
          subtotal,
        },
      });
      return this.findOne(id);
    } catch (error) {
      rethrowPrismaError(error, "Línea de proforma");
    }
  }

  async updateDetalle(id: string, detalleId: string, dto: UpdateDetalleDto) {
    const proforma = await this.findOne(id);
    this.assertBorrador(proforma);
    const detalle = proforma.detalles.find((d) => d.id === detalleId);
    if (!detalle) {
      throw new NotFoundException("Línea no encontrada.");
    }

    const cantidad = dto.cantidad ?? detalle.cantidad;
    let data: Prisma.ProformaDetalleUpdateInput;

    if (proforma.tipo === TipoProforma.VENTA) {
      const precioUnitario = dto.precioUnitario ?? Number(detalle.precioUnitario);
      data = { cantidad, precioUnitario, subtotal: cantidad * precioUnitario };
    } else {
      const precioCompra = dto.precioCompra ?? Number(detalle.precioCompra);
      const costoEnvio = dto.costoEnvio ?? Number(detalle.costoEnvio);
      const costoSeguridad = dto.costoSeguridad ?? Number(detalle.costoSeguridad);
      const costoLogistica = dto.costoLogistica ?? Number(detalle.costoLogistica);
      const costoUnitario = precioCompra + costoEnvio + costoSeguridad + costoLogistica;
      data = { cantidad, precioCompra, costoEnvio, costoSeguridad, costoLogistica, subtotal: cantidad * costoUnitario };
    }

    try {
      await this.prisma.proformaDetalle.update({ where: { id: detalleId }, data });
      return this.findOne(id);
    } catch (error) {
      rethrowPrismaError(error, "Línea de proforma");
    }
  }

  async removeDetalle(id: string, detalleId: string) {
    const proforma = await this.findOne(id);
    this.assertBorrador(proforma);
    if (!proforma.detalles.some((d) => d.id === detalleId)) {
      throw new NotFoundException("Línea no encontrada.");
    }
    try {
      await this.prisma.proformaDetalle.delete({ where: { id: detalleId } });
    } catch (error) {
      rethrowPrismaError(error, "Línea de proforma");
    }
  }

  /** BORRADOR → PENDIENTE. Transición simple: no toca stock, no necesita locking. */
  async enviar(id: string, usuarioId: string) {
    const proforma = await this.findOne(id);
    if (proforma.estado !== EstadoProforma.BORRADOR) {
      throw new ConflictException("Solo se puede enviar a revisión una proforma en BORRADOR.");
    }
    if (proforma.detalles.length === 0) {
      throw new BadRequestException("La proforma no tiene líneas.");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.proforma.update({ where: { id }, data: { estado: EstadoProforma.PENDIENTE } });
        await this.historial.registrar(tx, id, EstadoProforma.PENDIENTE, usuarioId);
        return tx.proforma.findUniqueOrThrow({ where: { id }, include: includeDetails });
      });
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
  }
}
