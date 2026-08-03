import { AttributeType, PrismaClient, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

async function seedAuth() {
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

async function seedCatalog() {
  const electronica = await prisma.category.upsert({
    where: { slug: "electronica" },
    update: {},
    create: { name: "Electrónica", slug: "electronica" },
  });

  const celulares = await prisma.category.upsert({
    where: { slug: "celulares" },
    update: {},
    create: {
      name: "Celulares",
      slug: "celulares",
      parentId: electronica.id,
      logisticsCost: 15,
      shippingCost: 8,
      securityCost: 3,
    },
  });

  const laptops = await prisma.category.upsert({
    where: { slug: "laptops" },
    update: {},
    create: {
      name: "Laptops",
      slug: "laptops",
      parentId: electronica.id,
      logisticsCost: 25,
      shippingCost: 12,
      securityCost: 5,
    },
  });

  // Atributo definido en la categoría padre: heredado por celulares y laptops.
  const garantia = await prisma.attribute.upsert({
    where: { categoryId_name: { categoryId: electronica.id, name: "Garantía (meses)" } },
    update: {},
    create: {
      categoryId: electronica.id,
      name: "Garantía (meses)",
      type: AttributeType.NUMBER,
      isFilterable: false,
      isRequired: false,
    },
  });

  const almacenamiento = await prisma.attribute.upsert({
    where: { categoryId_name: { categoryId: celulares.id, name: "Almacenamiento" } },
    update: {},
    create: {
      categoryId: celulares.id,
      name: "Almacenamiento",
      type: AttributeType.SELECT,
      isFilterable: true,
      isRequired: true,
    },
  });
  const [alm128, alm256] = await Promise.all(
    ["128GB", "256GB"].map((value) =>
      prisma.attributeOption.upsert({
        where: { attributeId_value: { attributeId: almacenamiento.id, value } },
        update: {},
        create: { attributeId: almacenamiento.id, value },
      }),
    ),
  );

  const colorCelular = await prisma.attribute.upsert({
    where: { categoryId_name: { categoryId: celulares.id, name: "Color" } },
    update: {},
    create: {
      categoryId: celulares.id,
      name: "Color",
      type: AttributeType.SELECT,
      isFilterable: true,
      isRequired: false,
    },
  });
  const [colorNegro, colorAzul] = await Promise.all(
    ["Negro", "Azul"].map((value) =>
      prisma.attributeOption.upsert({
        where: { attributeId_value: { attributeId: colorCelular.id, value } },
        update: {},
        create: { attributeId: colorCelular.id, value },
      }),
    ),
  );

  const ram = await prisma.attribute.upsert({
    where: { categoryId_name: { categoryId: laptops.id, name: "RAM" } },
    update: {},
    create: {
      categoryId: laptops.id,
      name: "RAM",
      type: AttributeType.SELECT,
      isFilterable: true,
      isRequired: true,
    },
  });
  const ram16 = await prisma.attributeOption.upsert({
    where: { attributeId_value: { attributeId: ram.id, value: "16GB" } },
    update: {},
    create: { attributeId: ram.id, value: "16GB" },
  });

  const samsung = await prisma.brand.upsert({
    where: { slug: "samsung" },
    update: {},
    create: { name: "Samsung", slug: "samsung" },
  });
  const apple = await prisma.brand.upsert({
    where: { slug: "apple" },
    update: {},
    create: { name: "Apple", slug: "apple" },
  });

  await Promise.all([
    prisma.brandCategory.upsert({
      where: { brandId_categoryId: { brandId: samsung.id, categoryId: celulares.id } },
      update: {},
      create: { brandId: samsung.id, categoryId: celulares.id },
    }),
    prisma.brandCategory.upsert({
      where: { brandId_categoryId: { brandId: apple.id, categoryId: celulares.id } },
      update: {},
      create: { brandId: apple.id, categoryId: celulares.id },
    }),
    prisma.brandCategory.upsert({
      where: { brandId_categoryId: { brandId: apple.id, categoryId: laptops.id } },
      update: {},
      create: { brandId: apple.id, categoryId: laptops.id },
    }),
  ]);

  const galaxyS24 = await prisma.product.upsert({
    where: { productCode: "SAMS24A" },
    update: {},
    create: {
      name: "Samsung Galaxy S24",
      productCode: "SAMS24A",
      price: 899.99,
      stock: 25,
      utility: 150,
      brandId: samsung.id,
      categoryId: celulares.id,
    },
  });
  const iphone15 = await prisma.product.upsert({
    where: { productCode: "APLIP15" },
    update: {},
    create: {
      name: "iPhone 15",
      productCode: "APLIP15",
      price: 1099,
      stock: 15,
      utility: 200,
      brandId: apple.id,
      categoryId: celulares.id,
    },
  });
  const macbookAir = await prisma.product.upsert({
    where: { productCode: "APLMBA1" },
    update: {},
    create: {
      name: "MacBook Air M3",
      productCode: "APLMBA1",
      price: 1299,
      stock: 10,
      utility: 180,
      brandId: apple.id,
      categoryId: laptops.id,
    },
  });

  const productAttributeValues = [
    { productId: galaxyS24.id, attributeId: almacenamiento.id, optionId: alm128.id },
    { productId: galaxyS24.id, attributeId: colorCelular.id, optionId: colorNegro.id },
    { productId: galaxyS24.id, attributeId: garantia.id, valueNumber: 12 },
    { productId: iphone15.id, attributeId: almacenamiento.id, optionId: alm256.id },
    { productId: iphone15.id, attributeId: colorCelular.id, optionId: colorAzul.id },
    { productId: iphone15.id, attributeId: garantia.id, valueNumber: 12 },
    { productId: macbookAir.id, attributeId: ram.id, optionId: ram16.id },
    { productId: macbookAir.id, attributeId: garantia.id, valueNumber: 12 },
  ];

  for (const value of productAttributeValues) {
    await prisma.productAttributeValue.upsert({
      where: { productId_attributeId: { productId: value.productId, attributeId: value.attributeId } },
      update: {},
      create: value,
    });
  }

  console.log("Catálogo de ejemplo sembrado: 3 categorías, 2 marcas, 4 atributos, 3 productos.");
}

async function main() {
  await seedAuth();
  await seedCatalog();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
