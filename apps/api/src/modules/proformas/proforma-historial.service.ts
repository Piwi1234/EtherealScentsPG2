import { Injectable } from "@nestjs/common";
import { EstadoProforma, Prisma } from "@app/database";

/** Único lugar que escribe en ProformaHistorial — evita duplicar el insert en cada transición. */
@Injectable()
export class ProformaHistorialService {
  async registrar(
    tx: Prisma.TransactionClient,
    proformaId: string,
    estado: EstadoProforma,
    usuarioId: string,
    nota?: string,
  ) {
    await tx.proformaHistorial.create({
      data: { proformaId, estado, usuarioId, nota },
    });
  }
}
