import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoProforma, Prisma, TipoProforma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { SettingsService } from "../../settings/settings.service";
import { computeBsPrices, computeCatalogPrice } from "../../catalog/product-price";
import { generateUniqueEntityCode } from "../../catalog/entity-code";
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
  almacen: true,
  ciudadEntrega: true,
  proveedor: true,
  paisProcedencia: true,
  creadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
  detalles: {
    include: {
      // attributeValues+attribute+option: atributos NONE (un valor por producto). variantOptionValues:
      // atributos MULTI_VALUE (el producto puede tener 1+ valores, ej. sabores de un vape) — ambos
      // hacen falta para mostrar los atributos marcados mostrarEnProforma en la vista de detalle.
      // options: qué distingue a ESTA variante puntual (ej. "Tamaño: 50 ML"). brand: para mostrar la
      // marca en la tabla de productos de la proforma.
      variante: {
        include: {
          product: {
            include: {
              attributeValues: { include: { attribute: true, option: true } },
              variantOptionValues: { include: { attribute: true } },
              brand: true,
            },
          },
          options: { include: { optionValue: { include: { attribute: true } } } },
        },
      },
      // VENTA de una variante unidad=ML: qué presentación (subvariante) se vendió en esta línea.
      presentacionVenta: true,
      asignaciones: { include: { almacen: true } },
      loteCompras: true,
    },
  },
  historial: {
    orderBy: { fecha: "desc" as const },
    include: { usuario: { select: { id: true, nombre: true } } },
  },
  // Solo VENTA, y solo si quedó saldo pendiente al completar (ver proforma-completion.service.ts).
  cuentaPorCobrar: true,
} satisfies Prisma.ProformaInclude;

/**
 * CRUD y queries de proformas — sin locking ni efectos de stock. Las transiciones que tocan Stock
 * (aprobar VENTA, anular desde APROBADA, completar) viven en proforma-approval.service.ts y
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
    const hasta = query.fechaHasta ? new Date(query.fechaHasta) : undefined;
    if (hasta) hasta.setUTCHours(23, 59, 59, 999);

    const where: Prisma.ProformaWhereInput = {
      tipo: query.tipo,
      estado: query.estado,
      empresaId: query.empresaId,
      creadoPorId: query.creadoPorId,
      clienteId: query.clienteId,
      proveedorId: query.proveedorId,
      ciudadEntregaId: query.ciudadEntregaId,
      paisProcedenciaId: query.paisProcedenciaId,
      codigo: query.codigo ? query.codigo.trim().toUpperCase() : undefined,
      fecha: {
        gte: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
        lte: hasta,
      },
    };
    const [items, total] = await Promise.all([
      this.prisma.proforma.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: includeDetails }),
      this.prisma.proforma.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** Solo quienes crearon al menos una VENTA — no el listado completo de usuarios (evita depender del
   * endpoint /usuarios, restringido a ADMIN, cuando Proformas también lo usa un SELLER). */
  findVendedores() {
    return this.prisma.usuario.findMany({
      where: { proformasCreadas: { some: { tipo: TipoProforma.VENTA } } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    });
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

  private async assertCiudadExists(id: string) {
    const ciudad = await this.prisma.ciudad.findUnique({ where: { id } });
    if (!ciudad) throw new BadRequestException(`ciudadEntregaId inválido: ${id}`);
  }

  private async assertPaisProcedenciaExists(id: string) {
    const pais = await this.prisma.paisProcedencia.findUnique({ where: { id } });
    if (!pais) throw new BadRequestException(`paisProcedenciaId inválido: ${id}`);
  }

  private async assertProveedorExists(id: string) {
    const proveedor = await this.prisma.proveedor.findUnique({ where: { id } });
    if (!proveedor) throw new BadRequestException(`proveedorId inválido: ${id}`);
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

  /** Código corto para mostrar/buscar en vez del id UUID — ver doc-comment de Proforma.codigo en
   * schema.prisma. Mismo mecanismo que Product.productCode / ProductVariant.variantCode. */
  private generateCodigo() {
    return generateUniqueEntityCode(async (code) => {
      const existing = await this.prisma.proforma.findUnique({ where: { codigo: code }, select: { id: true } });
      return Boolean(existing);
    });
  }

  /** El almacén ya no se pide acá para ningún tipo: para VENTA se fija al aprobar, para COMPRA al
   * completar (ver proforma-approval.service.ts / proforma-completion.service.ts). */
  async create(dto: CreateProformaDto, creadoPorId: string) {
    await this.assertEmpresaExists(dto.empresaId);

    if (dto.tipo === TipoProforma.VENTA) {
      if (!dto.clienteId) throw new BadRequestException("clienteId es obligatorio para una proforma de venta.");
      await this.assertClienteExists(dto.clienteId);
      if (dto.ciudadEntregaId) await this.assertCiudadExists(dto.ciudadEntregaId);
      if (dto.proveedorId) throw new BadRequestException("proveedorId no aplica a una proforma de venta.");
      if (dto.paisProcedenciaId) throw new BadRequestException("paisProcedenciaId no aplica a una proforma de venta.");
      if (dto.tipoCambioProf !== undefined) throw new BadRequestException("tipoCambioProf no aplica a una proforma de venta.");
    } else {
      if (dto.clienteId) throw new BadRequestException("clienteId no aplica a una proforma de compra.");
      if (dto.ciudadEntregaId) throw new BadRequestException("ciudadEntregaId no aplica a una proforma de compra.");
      if (!dto.proveedorId) throw new BadRequestException("proveedorId es obligatorio para una proforma de compra.");
      await this.assertProveedorExists(dto.proveedorId);
      if (dto.paisProcedenciaId) await this.assertPaisProcedenciaExists(dto.paisProcedenciaId);
      if (dto.descuentoGeneral) throw new BadRequestException("descuentoGeneral no aplica a una proforma de compra.");
      if (dto.adelantoPorcentaje) throw new BadRequestException("adelantoPorcentaje no aplica a una proforma de compra.");
    }

    // Para COMPRA, si no se manda un tipo de cambio propio, arranca con el del sistema — queda
    // editable después mientras esté en BORRADOR, por si la compra se hizo a otro tipo de cambio.
    const tipoCambioProf =
      dto.tipo === TipoProforma.COMPRA ? dto.tipoCambioProf ?? (await this.settings.getExchangeRate()) : undefined;
    const codigo = await this.generateCodigo();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const proforma = await tx.proforma.create({
          data: {
            tipo: dto.tipo,
            codigo,
            empresaId: dto.empresaId,
            clienteId: dto.tipo === TipoProforma.VENTA ? dto.clienteId : undefined,
            ciudadEntregaId: dto.tipo === TipoProforma.VENTA ? dto.ciudadEntregaId : undefined,
            proveedorId: dto.tipo === TipoProforma.COMPRA ? dto.proveedorId : undefined,
            paisProcedenciaId: dto.tipo === TipoProforma.COMPRA ? dto.paisProcedenciaId : undefined,
            tipoCambioProf,
            creadoPorId,
            descuentoGeneral: dto.descuentoGeneral ?? 0,
            adelantoPorcentaje: dto.adelantoPorcentaje,
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
      if (dto.clienteId) await this.assertClienteExists(dto.clienteId);
      if (dto.ciudadEntregaId) await this.assertCiudadExists(dto.ciudadEntregaId);
      if (dto.proveedorId !== undefined) {
        throw new BadRequestException("proveedorId no aplica a una proforma de venta.");
      }
      if (dto.paisProcedenciaId !== undefined) {
        throw new BadRequestException("paisProcedenciaId no aplica a una proforma de venta.");
      }
      if (dto.tipoCambioProf !== undefined) {
        throw new BadRequestException("tipoCambioProf no aplica a una proforma de venta.");
      }
    } else {
      if (dto.clienteId !== undefined) {
        throw new BadRequestException("clienteId no aplica a una proforma de compra.");
      }
      if (dto.ciudadEntregaId !== undefined) {
        throw new BadRequestException("ciudadEntregaId no aplica a una proforma de compra.");
      }
      if (dto.proveedorId) await this.assertProveedorExists(dto.proveedorId);
      if (dto.paisProcedenciaId) await this.assertPaisProcedenciaExists(dto.paisProcedenciaId);
      if (dto.descuentoGeneral) throw new BadRequestException("descuentoGeneral no aplica a una proforma de compra.");
      if (dto.adelantoPorcentaje) throw new BadRequestException("adelantoPorcentaje no aplica a una proforma de compra.");
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

    let cantidad: number;
    let precioUnitario: number;
    let presentacionVentaId: string | null = null;

    if (dto.presentacionVentaId) {
      if (!dto.numPresentaciones) {
        throw new BadRequestException("numPresentaciones es obligatorio junto con presentacionVentaId.");
      }
      const presentacion = await this.prisma.presentacionVenta.findUnique({ where: { id: dto.presentacionVentaId } });
      if (!presentacion || presentacion.varianteId !== dto.varianteId) {
        throw new BadRequestException("presentacionVentaId inválido para esta variante.");
      }
      if (!presentacion.activo) {
        throw new BadRequestException("Esta presentación está desactivada.");
      }
      presentacionVentaId = presentacion.id;
      cantidad = dto.numPresentaciones * presentacion.cantidadMl;
      precioUnitario = Number(presentacion.precioVentaBs) / presentacion.cantidadMl;
    } else {
      if (!dto.cantidad) {
        throw new BadRequestException("cantidad es obligatoria (o presentacionVentaId + numPresentaciones).");
      }
      cantidad = dto.cantidad;
      precioUnitario = dto.precioUnitario ?? (await this.computePrecioFinalBs(variante));
    }

    const subtotal = cantidad * precioUnitario;

    try {
      await this.prisma.proformaDetalle.create({
        data: { proformaId: id, varianteId: dto.varianteId, presentacionVentaId, cantidad, precioUnitario, subtotal },
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

  /** Solo se puede eliminar una proforma mientras está en BORRADOR — nunca tocó stock, así que no hay
   * nada que revertir; la cascada (detalles + historial) ya está cubierta por el schema. */
  async remove(id: string) {
    const proforma = await this.findOne(id);
    this.assertBorrador(proforma);
    try {
      await this.prisma.proforma.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
  }
}
