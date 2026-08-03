import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@app/database";

export function rethrowPrismaError(error: unknown, entityName: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      throw new NotFoundException(`${entityName} no encontrado.`);
    }
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ") ?? "campo único";
      throw new ConflictException(`Ya existe un registro con el mismo valor de ${target}.`);
    }
    if (error.code === "P2003") {
      throw new ConflictException(
        `No se puede completar la operación: existen registros relacionados con este ${entityName.toLowerCase()}.`,
      );
    }
  }
  throw error;
}
