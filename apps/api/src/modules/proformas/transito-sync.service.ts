import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { EstadoProforma, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { recalcularTransitoLinea } from "./transito.util";

/**
 * Al arrancar, deja el stock en tránsito al día con lo que realmente viaja (envíos despachados). Es idempotente: cada
 * línea compara lo que debería aportar contra lo que ya contó (ProformaDetalle.enTransitoContado) y solo ajusta la
 * diferencia. Corrige el tránsito contado con la regla anterior (recogido sin enviar) y se autocorrige si alguna vez
 * se desfasa.
 */
@Injectable()
export class TransitoSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TransitoSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      const lineas = await this.prisma.proformaDetalle.findMany({
        where: { OR: [{ enTransitoContado: { gt: 0 } }, { proforma: { tipo: TipoProforma.COMPRA, estado: EstadoProforma.APROBADA } }] },
        select: { id: true },
      });
      let ajustadas = 0;
      for (const { id } of lineas) {
        try {
          const antes = await this.prisma.proformaDetalle.findUnique({ where: { id }, select: { enTransitoContado: true } });
          await this.prisma.$transaction((tx) => recalcularTransitoLinea(tx, id), { timeout: 20000, maxWait: 5000 });
          const despues = await this.prisma.proformaDetalle.findUnique({ where: { id }, select: { enTransitoContado: true } });
          if (antes?.enTransitoContado !== despues?.enTransitoContado) ajustadas++;
        } catch (error) {
          this.logger.warn(`No se pudo recalcular el tránsito de la línea ${id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (ajustadas > 0) this.logger.log(`Tránsito recalculado: ${ajustadas} línea(s) ajustada(s).`);
    } catch (error) {
      this.logger.warn(`No se pudo recalcular el tránsito al arrancar: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
