import { PrismaClient, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [adminRole] = await Promise.all(
    [RoleName.ADMIN, RoleName.USER].map((name) =>
      prisma.role.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  // Password: Admin1.
  const passwordHash = "$2b$10$YsJ0n2mEbzy9RsLytkm6OenZgL/QYiBC7dyxWJHUmJYXYq7GQddpu";

  await prisma.user.upsert({
    where: { email: "admin@gmail.com" },
    update: {},
    create: {
      email: "admin@gmail.com",
      passwordHash,
      firstName: "Admin",
      lastName: "Principal",
      roleId: adminRole.id,
    },
  });

  console.log("Seed listo: admin@gmail.com / Admin1.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
