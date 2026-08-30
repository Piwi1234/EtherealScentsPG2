import { ConflictException } from "@nestjs/common";
import { Prisma } from "@app/database";
import { PrismaService } from "./prisma.service";

/**
 * numeroDocumento y email son los campos clave para evitar duplicados de Cliente. Usado tanto por
 * el alta manual desde gestión (ClientesService) como por el autorregistro público
 * (ClienteAuthService) — mismo chequeo, distinto origen.
 */
export async function validarClienteNoDuplicado(
  prisma: PrismaService,
  fields: { numeroDocumento?: string; email?: string },
  excludeId?: string,
) {
  const or: Prisma.ClienteWhereInput[] = [];
  if (fields.numeroDocumento) or.push({ numeroDocumento: fields.numeroDocumento });
  if (fields.email) or.push({ email: fields.email });
  if (or.length === 0) return;

  const existing = await prisma.cliente.findFirst({
    where: { OR: or, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (!existing) return;

  const campo =
    fields.numeroDocumento && existing.numeroDocumento === fields.numeroDocumento
      ? "número de documento"
      : "email";
  throw new ConflictException(`Ya existe un cliente registrado con ese ${campo}.`);
}
