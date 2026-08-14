import { BadRequestException, Injectable } from "@nestjs/common";
import { NaturalezaMovimiento } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CarteraService } from "./cartera.service";
import { lockCarteras } from "./cartera-lock.util";
import { CreateTraspasoDto } from "./dto/create-traspaso.dto";

/**
 * Mueve montoOrigen de una cartera a otra — incluso entre monedas distintas, con un tipo de cambio
 * pedido en el momento (se guarda ya calculado en Traspaso.montoDestino, para que quede una
 * constancia estable). Genera 2 MovimientoCartera atómicamente (GASTO en origen, INGRESO en
 * destino) y actualiza el saldoActual de ambas carteras. Inmutable, igual que MovimientoCartera —
 * no hay update/delete.
 */
@Injectable()
export class TraspasoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carteras: CarteraService,
  ) {}

  async create(dto: CreateTraspasoDto, usuarioId: string) {
    if (dto.carteraOrigenId === dto.carteraDestinoId) {
      throw new BadRequestException("La cartera de origen y destino no pueden ser la misma.");
    }

    const [origen, destino] = await Promise.all([
      this.carteras.findOne(dto.carteraOrigenId),
      this.carteras.findOne(dto.carteraDestinoId),
    ]);

    let tipoCambio = 1;
    if (origen.moneda !== destino.moneda) {
      if (!dto.tipoCambio) {
        throw new BadRequestException("tipoCambio es obligatorio: origen y destino tienen monedas distintas.");
      }
      tipoCambio = dto.tipoCambio;
    }
    const montoDestino = dto.montoOrigen * tipoCambio;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
        await lockCarteras(tx, [dto.carteraOrigenId, dto.carteraDestinoId]);

        const traspaso = await tx.traspaso.create({
          data: {
            fecha: new Date(dto.fecha),
            carteraOrigenId: dto.carteraOrigenId,
            carteraDestinoId: dto.carteraDestinoId,
            montoOrigen: dto.montoOrigen,
            tipoCambio,
            montoDestino,
            nota: dto.nota,
            creadoPorId: usuarioId,
          },
        });

        await tx.movimientoCartera.create({
          data: {
            carteraId: dto.carteraOrigenId,
            fecha: new Date(dto.fecha),
            detalle: `Traspaso a ${destino.nombre}`,
            naturaleza: NaturalezaMovimiento.GASTO,
            monto: dto.montoOrigen,
            traspasoId: traspaso.id,
            creadoPorId: usuarioId,
          },
        });
        await tx.movimientoCartera.create({
          data: {
            carteraId: dto.carteraDestinoId,
            fecha: new Date(dto.fecha),
            detalle: `Traspaso desde ${origen.nombre}`,
            naturaleza: NaturalezaMovimiento.INGRESO,
            monto: montoDestino,
            traspasoId: traspaso.id,
            creadoPorId: usuarioId,
          },
        });

        await tx.cartera.update({ where: { id: dto.carteraOrigenId }, data: { saldoActual: { decrement: dto.montoOrigen } } });
        await tx.cartera.update({ where: { id: dto.carteraDestinoId }, data: { saldoActual: { increment: montoDestino } } });

        return tx.traspaso.findUniqueOrThrow({
          where: { id: traspaso.id },
          include: {
            carteraOrigen: { select: { id: true, nombre: true, moneda: true } },
            carteraDestino: { select: { id: true, nombre: true, moneda: true } },
            movimientos: true,
          },
        });
      });
    } catch (error) {
      rethrowPrismaError(error, "Traspaso");
    }
  }
}
