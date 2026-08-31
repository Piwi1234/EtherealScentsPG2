import { PrismaClient, Rol } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Crea (o resetea la contraseña de) el admin inicial, sin tocar el resto de datos de ejemplo que
 * trae seed.ts. Pensado para correr una sola vez contra una base nueva (ej. producción recién
 * desplegada) apuntando DATABASE_URL a esa base antes de ejecutar este script.
 *
 * Único lugar (junto con seedAuth() en seed.ts) donde se crea un usuario ADMIN: nunca vía endpoint
 * público (ver modules/usuarios, que solo permite crear usuarios a un ADMIN ya autenticado).
 */
async function main() {
  // Password: Admin123. (8+ caracteres, requerido por LoginDto/CreateUsuarioDto).
  // Cambiarla apenas se loguee: este hash está en el repo público, no es secreta.
  const passwordHash = "$2b$10$I49ldw4ZoDJztzWjvv2dWu79rCbHxcKdV8.J9LXAzCIEbd/7O7Dba";

  await prisma.usuario.upsert({
    where: { email: "admin@gmail.com" },
    update: { passwordHash },
    create: {
      email: "admin@gmail.com",
      passwordHash,
      nombre: "Admin Principal",
      rol: Rol.ADMIN,
    },
  });

  console.log("Admin listo: admin@gmail.com / Admin123. — cambiar la contraseña apenas entres.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
