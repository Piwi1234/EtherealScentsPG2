import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoProforma, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { SettingsService } from "../../settings/settings.service";
import { computeBsPrices, computeCatalogPrice } from "../../catalog/product-price";
import { generateUniqueEntityCode } from "../../catalog/entity-code";
import { ProformaHistorialService } from "./proforma-historial.service";
import { recalcularDescuentoGeneral } from "./proforma-totales.util";
import { compraConEnlacesSelect, enviadasDeEnlace, estadoSegunCompra, recogidasDeEnlace } from "./recojo.util";
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
  creadoPor: { select: { id: true, nombre: true, email: true, rol: true } },
  detalles: {
    // Sin esto, Postgres devuelve las filas en su orden físico (sin ORDER BY no hay garantía de
    // orden), que cambia con cada UPDATE — una línea "saltaba" al final apenas se editaba cualquier
    // valor. Alfabético por marca y luego por producto, de paso: mismo criterio pedido para el orden
    // de visualización de las líneas.
    orderBy: [
      { variante: { product: { brand: { name: "asc" as const } } } },
      { variante: { product: { name: "asc" as const } } },
    ],
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
      // COMPRA: a quién se le compra ESTA línea puntual (ver comentario en schema.prisma) — null
      // para líneas de VENTA.
      proveedor: true,
      // COMPRA: cuánto de la línea está ligado a faltantes de notas de venta.
      asignacionesCubiertas: { select: { cantidad: true } },
      solicitudesCubiertas: { select: { cantidad: true } },
      // COMPRA: lo recogido de esta línea (suma de los recojos).
      recojoLineas: { select: { cantidad: true } },
      // VENTA: la compra que cubre cada faltante (Procura), con lo recogido/enviado para derivar su estado.
      asignaciones: {
        include: {
          almacen: true,
          compraDetalle: {
            select: { id: true, cantidad: true, proforma: { select: { id: true, codigo: true, estado: true } }, ...compraConEnlacesSelect },
          },
        },
      },
      loteCompras: true,
      // VENTA: lo entregado al cliente, entrega por entrega.
      entregas: { orderBy: { fecha: "asc" as const }, include: { creadoPor: { select: { id: true, nombre: true } } } },
    },
  },
  historial: {
    orderBy: { fecha: "desc" as const },
    include: { usuario: { select: { id: true, nombre: true } } },
  },
  // COMPRA: proveedor de la nota (null en compras viejas que mezclaban proveedores).
  proveedor: { select: { id: true, nombre: true } },
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
      // El proveedor es por línea, no por documento — filtra proformas que tengan AL MENOS una
      // línea de ese proveedor (ver ProformaDetalle.proveedorId).
      detalles: query.proveedorId ? { some: { proveedorId: query.proveedorId } } : undefined,
      ciudadEntregaId: query.ciudadEntregaId,
      codigo: query.codigo ? { contains: query.codigo.trim(), mode: "insensitive" } : undefined,
      fecha: {
        gte: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
        lte: hasta,
      },
    };
    // Estado de entrega de una venta aprobada: pendiente = faltante (Procura) o reserva en tránsito sin llegar.
    const conPendiente: Prisma.ProformaWhereInput = {
      detalles: { some: { asignaciones: { some: { origen: { in: [OrigenAsignacion.PROCURA, OrigenAsignacion.EN_TRANSITO] }, cantidad: { gt: 0 } } } } },
    };
    const extra: Prisma.ProformaWhereInput[] = [];
    if (query.entrega) {
      where.tipo = TipoProforma.VENTA;
      where.estado = EstadoProforma.APROBADA;
      extra.push(query.entrega === "LISTA" ? { NOT: conPendiente } : conPendiente);
    }
    if (extra.length > 0) where.AND = extra;

    const [items, total] = await Promise.all([
      this.prisma.proforma.findMany({ where, skip, take, orderBy: [{ estadoActualizadoAt: "desc" }, { createdAt: "desc" }], include: includeDetails }),
      this.prisma.proforma.count({ where }),
    ]);
    // Cada faltante lleva el estado de la compra que lo cubre (comprado, recogido, enviado), como en el detalle.
    return { items: items.map((p) => this.conEstadoDeFaltantes(p)), total, page, pageSize };
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
    return this.conEstadoDeFaltantes(proforma);
  }

  /** A cada faltante (Procura) de una venta le suma el estado de la compra que lo cubre: comprado, recogido o enviado. */
  private conEstadoDeFaltantes<T extends { detalles: { asignaciones: { id: string; origen: OrigenAsignacion; cantidad: number; compraDetalle: Prisma.ProformaDetalleGetPayload<{ select: { id: true; cantidad: true; proforma: { select: { id: true; codigo: true; estado: true } } } }> & { recojoLineas: { cantidad: number }[]; envioItems: { cantidad: number }[]; asignacionesCubiertas: { id: string; cantidad: number; createdAt: Date }[]; solicitudesCubiertas: { id: string; cantidad: number; createdAt: Date }[] } | null }[] }[] }>(proforma: T) {
    return {
      ...proforma,
      detalles: proforma.detalles.map((d) => ({
        ...d,
        asignaciones: d.asignaciones.map((a) => {
          if (a.origen !== OrigenAsignacion.PROCURA || a.cantidad <= 0) return { ...a, estadoPedido: null, recogidas: 0, enviadas: 0 };
          const recogidas = a.compraDetalle ? recogidasDeEnlace(a.compraDetalle, a.id) : 0;
          const enviadas = a.compraDetalle ? enviadasDeEnlace(a.compraDetalle, a.id) : 0;
          return { ...a, recogidas, enviadas, estadoPedido: estadoSegunCompra(a.compraDetalle?.proforma.estado, a.cantidad, recogidas, enviadas) };
        }),
      })),
    };
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
      // El cliente puede elegirse después, en la cabecera del BORRADOR; es obligatorio recién al aprobar.
      if (dto.clienteId) await this.assertClienteExists(dto.clienteId);
      if (dto.ciudadEntregaId) await this.assertCiudadExists(dto.ciudadEntregaId);
      if (dto.tipoCambioProf !== undefined) throw new BadRequestException("tipoCambioProf no aplica a una proforma de venta.");
    } else {
      if (dto.clienteId) throw new BadRequestException("clienteId no aplica a una proforma de compra.");
      if (dto.ciudadEntregaId) throw new BadRequestException("ciudadEntregaId no aplica a una proforma de compra.");
      if (dto.adelantoPorcentaje) throw new BadRequestException("adelantoPorcentaje no aplica a una proforma de compra.");
      if (dto.proveedorId) await this.assertProveedorExists(dto.proveedorId);
    }
    if (dto.tipo === TipoProforma.VENTA && dto.proveedorId) {
      throw new BadRequestException("proveedorId no aplica a una proforma de venta.");
    }

    // Para COMPRA, si no se manda un tipo de cambio propio, arranca con el del sistema — queda
    // editable después mientras esté en BORRADOR, por si la compra se hizo a otro tipo de cambio.
    const tipoCambioProf =
      dto.tipo === TipoProforma.COMPRA ? dto.tipoCambioProf ?? (await this.settings.getExchangeRate()) : undefined;
    const codigo = await this.generateCodigo();

    // COMPRA: almacén destino de la mercadería (el predeterminado si no se elige).
    let almacenCompraId: string | undefined;
    if (dto.tipo === TipoProforma.COMPRA) {
      if (dto.almacenId) {
        if (!(await this.prisma.almacen.findUnique({ where: { id: dto.almacenId }, select: { id: true } }))) throw new BadRequestException(`almacenId inválido: ${dto.almacenId}`);
        almacenCompraId = dto.almacenId;
      } else {
        almacenCompraId = (
          (await this.prisma.almacen.findFirst({ where: { activo: true, predeterminado: true }, select: { id: true } })) ??
          (await this.prisma.almacen.findFirst({ where: { activo: true }, orderBy: { createdAt: "asc" }, select: { id: true } }))
        )?.id;
      }
    } else if (dto.almacenId) {
      throw new BadRequestException("almacenId no aplica a una proforma de venta al crearla (se elige al aprobar).");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const proforma = await tx.proforma.create({
          data: {
            almacenId: almacenCompraId,
            tipo: dto.tipo,
            codigo,
            empresaId: dto.empresaId,
            clienteId: dto.tipo === TipoProforma.VENTA ? dto.clienteId : undefined,
            ciudadEntregaId: dto.tipo === TipoProforma.VENTA ? dto.ciudadEntregaId : undefined,
            tipoCambioProf,
            proveedorId: dto.tipo === TipoProforma.COMPRA ? dto.proveedorId : undefined,
            creadoPorId,
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
      if (dto.tipoCambioProf !== undefined) {
        throw new BadRequestException("tipoCambioProf no aplica a una proforma de venta.");
      }
      if (dto.proveedorId !== undefined) throw new BadRequestException("proveedorId no aplica a una proforma de venta.");
      if (dto.almacenId !== undefined) throw new BadRequestException("almacenId no aplica a una proforma de venta.");
    } else {
      if (dto.almacenId && !(await this.prisma.almacen.findUnique({ where: { id: dto.almacenId }, select: { id: true } }))) {
        throw new BadRequestException(`almacenId inválido: ${dto.almacenId}`);
      }
      if (dto.proveedorId) await this.assertProveedorExists(dto.proveedorId);
      if (dto.clienteId !== undefined) {
        throw new BadRequestException("clienteId no aplica a una proforma de compra.");
      }
      if (dto.ciudadEntregaId !== undefined) {
        throw new BadRequestException("ciudadEntregaId no aplica a una proforma de compra.");
      }
      if (dto.adelantoPorcentaje) throw new BadRequestException("adelantoPorcentaje no aplica a una proforma de compra.");
    }
    if (dto.empresaId) await this.assertEmpresaExists(dto.empresaId);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.proforma.update({ where: { id }, data: dto });
        // Las líneas heredan el proveedor de la nota: al cambiarlo en la cabecera se actualizan todas.
        if (existing.tipo === TipoProforma.COMPRA && dto.proveedorId) {
          await tx.proformaDetalle.updateMany({ where: { proformaId: id }, data: { proveedorId: dto.proveedorId } });
        }
      });
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
    let costoEmpaqueBs = 0;

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
      costoEmpaqueBs = Number(presentacion.costoEmpaqueBs);
      cantidad = dto.numPresentaciones * presentacion.cantidadMl;
      precioUnitario = Number(presentacion.precioVentaBs) / presentacion.cantidadMl;
    } else {
      if (!dto.cantidad) {
        throw new BadRequestException("cantidad es obligatoria (o presentacionVentaId + numPresentaciones).");
      }
      cantidad = dto.cantidad;
      precioUnitario = dto.precioUnitario ?? (await this.computePrecioFinalBs(variante));
    }

    // Mismo producto (y misma presentación) → se acumula en la línea existente, no se duplica la fila.
    const existente = proforma.detalles.find((d) => d.varianteId === dto.varianteId && (d.presentacionVentaId ?? null) === presentacionVentaId);
    if (existente) {
      const nuevaCantidad = existente.cantidad + cantidad;
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.proformaDetalle.update({
            where: { id: existente.id },
            data: { cantidad: nuevaCantidad, subtotal: nuevaCantidad * Number(existente.precioUnitario) },
          });
          await recalcularDescuentoGeneral(tx, id);
        });
        return this.findOne(id);
      } catch (error) {
        rethrowPrismaError(error, "Línea de proforma");
      }
    }

    const subtotal = cantidad * precioUnitario;

    try {
      await this.prisma.proformaDetalle.create({
        data: { proformaId: id, varianteId: dto.varianteId, presentacionVentaId, costoEmpaqueBs, cantidad, precioUnitario, subtotal },
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
    // La línea hereda el proveedor de la nota; solo en compras viejas sin proveedor de cabecera se
    // acepta el de la línea.
    const proveedorId = proforma.proveedorId ?? dto.proveedorId;
    if (proveedorId) await this.assertProveedorExists(proveedorId);

    // Misma variante (y mismo proveedor, en compras viejas mezcladas) → se acumula en la línea existente.
    const existente = proforma.detalles.find(
      (d) => d.varianteId === dto.varianteId && (d.proveedorId ?? null) === (proveedorId ?? null),
    );
    if (existente) {
      const nuevaCantidad = existente.cantidad + dto.cantidad;
      const costoExistente =
        Number(existente.precioCompra) + Number(existente.costoEnvio) + Number(existente.costoSeguridad) + Number(existente.costoLogistica);
      try {
        await this.prisma.proformaDetalle.update({
          where: { id: existente.id },
          data: { cantidad: nuevaCantidad, subtotal: nuevaCantidad * costoExistente },
        });
        return this.findOne(id);
      } catch (error) {
        rethrowPrismaError(error, "Línea de proforma");
      }
    }

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
          proveedorId,
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
    // Unchecked (no Update a secas): para poder setear proveedorId directo como FK escalar en vez
    // de por `proveedor: { connect: ... }`.
    let data: Prisma.ProformaDetalleUncheckedUpdateInput;

    if (proforma.tipo === TipoProforma.VENTA) {
      const precioUnitario = dto.precioUnitario ?? Number(detalle.precioUnitario);
      const descuentoUnitario = dto.descuentoUnitario ?? Number(detalle.descuentoUnitario);
      if (descuentoUnitario > precioUnitario) {
        throw new BadRequestException("El descuento unitario no puede superar el precio unitario.");
      }
      data = { cantidad, precioUnitario, descuentoUnitario, subtotal: cantidad * precioUnitario };
    } else {
      const precioCompra = dto.precioCompra ?? Number(detalle.precioCompra);
      const costoEnvio = dto.costoEnvio ?? Number(detalle.costoEnvio);
      const costoSeguridad = dto.costoSeguridad ?? Number(detalle.costoSeguridad);
      const costoLogistica = dto.costoLogistica ?? Number(detalle.costoLogistica);
      const costoUnitario = precioCompra + costoEnvio + costoSeguridad + costoLogistica;
      // Con proveedor de cabecera, la línea siempre usa ese; el de la línea solo se edita en compras viejas.
      if (dto.proveedorId && !proforma.proveedorId) await this.assertProveedorExists(dto.proveedorId);
      const proveedorId = proforma.proveedorId ?? dto.proveedorId ?? detalle.proveedorId ?? undefined;
      data = {
        cantidad,
        precioCompra,
        costoEnvio,
        costoSeguridad,
        costoLogistica,
        proveedorId,
        subtotal: cantidad * costoUnitario,
      };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.proformaDetalle.update({ where: { id: detalleId }, data });
        if (proforma.tipo === TipoProforma.VENTA) await recalcularDescuentoGeneral(tx, id);
        // Si la cantidad baja por debajo de lo ligado a notas de venta, se sueltan los vínculos sobrantes.
        if (proforma.tipo === TipoProforma.COMPRA && dto.cantidad !== undefined) {
          // Primero se sueltan las solicitudes de stock (las ventas tienen prioridad), luego los faltantes.
          const solicitudes = await tx.solicitudStockLinea.findMany({ where: { compraDetalleId: detalleId }, orderBy: { createdAt: "desc" } });
          const ligadasVentas = await tx.proformaDetalleAsignacion.aggregate({ where: { compraDetalleId: detalleId }, _sum: { cantidad: true } });
          let excesoSolicitudes = (ligadasVentas._sum.cantidad ?? 0) + solicitudes.reduce((n, s) => n + s.cantidad, 0) - cantidad;
          for (const s of solicitudes) {
            if (excesoSolicitudes <= 0) break;
            if (s.cantidad <= excesoSolicitudes) {
              await tx.solicitudStockLinea.update({ where: { id: s.id }, data: { compraDetalleId: null } });
              excesoSolicitudes -= s.cantidad;
            } else {
              await tx.solicitudStockLinea.update({ where: { id: s.id }, data: { cantidad: { decrement: excesoSolicitudes } } });
              await tx.solicitudStockLinea.create({
                data: { solicitudId: s.solicitudId, varianteId: s.varianteId, cantidad: excesoSolicitudes, nota: s.nota, compraDetalleId: null },
              });
              excesoSolicitudes = 0;
            }
          }
          const ligadas = await tx.proformaDetalleAsignacion.findMany({
            where: { compraDetalleId: detalleId },
            orderBy: { createdAt: "desc" },
          });
          let exceso = ligadas.reduce((n, a) => n + a.cantidad, 0) - cantidad;
          for (const a of ligadas) {
            if (exceso <= 0) break;
            if (a.cantidad <= exceso) {
              await tx.proformaDetalleAsignacion.update({ where: { id: a.id }, data: { compraDetalleId: null } });
              exceso -= a.cantidad;
            } else {
              // Se suelta solo una parte: la fila se parte en una libre y otra que sigue ligada.
              await tx.proformaDetalleAsignacion.update({ where: { id: a.id }, data: { cantidad: { decrement: exceso } } });
              await tx.proformaDetalleAsignacion.create({
                data: {
                  proformaDetalleId: a.proformaDetalleId,
                  almacenId: a.almacenId,
                  cantidad: exceso,
                  origen: a.origen,
                  estadoSeguimiento: a.estadoSeguimiento,
                  compraDetalleId: null,
                },
              });
              exceso = 0;
            }
          }
        }
      });
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
      await this.prisma.$transaction(async (tx) => {
        await tx.proformaDetalle.delete({ where: { id: detalleId } });
        if (proforma.tipo === TipoProforma.VENTA) await recalcularDescuentoGeneral(tx, id);
      });
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
