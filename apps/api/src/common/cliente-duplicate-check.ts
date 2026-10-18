import { ConflictException } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * email es el campo clave para evitar duplicados de Cliente. Usado tanto por el alta manual desde
 * gestión (ClientesService) como por el autorregistro público (ClienteAuthService) — mismo chequeo,
 * distinto origen.
 */
export async function validarClienteNoDuplicado(prisma: PrismaService, fields: { email?: string }, excludeId?: string) {
  if (!fields.email) return;

  const existing = await prisma.cliente.findFirst({
    where: { email: fields.email, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (!existing) return;

  throw new ConflictException("Ya existe un cliente registrado con ese email.");
}
