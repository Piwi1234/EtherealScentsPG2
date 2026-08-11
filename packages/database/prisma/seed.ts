import { AttributeType, EstadoProforma, PrismaClient, Rol, TipoEmpresa, TipoProforma } from "@prisma/client";

const prisma = new PrismaClient();

const VARIANT_CODE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomVariantCode(): string {
  let code = "";
  for (let i = 0; i < 7; i++) code += VARIANT_CODE_CHARSET[Math.floor(Math.random() * VARIANT_CODE_CHARSET.length)];
  return code;
}

async function generateUniqueVariantCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomVariantCode();
    const existing = await prisma.productVariant.findUnique({ where: { variantCode: code } });
    if (!existing) return code;
  }
  throw new Error("No se pudo generar un variantCode único.");
}

/**
 * Único lugar donde se crea un usuario ADMIN: nunca vía endpoint público (ver
 * modules/usuarios, que solo permite crear usuarios a un ADMIN ya autenticado).
 */
async function seedAuth() {
  // Password: Admin123. (8+ caracteres, requerido por LoginDto/CreateUsuarioDto).
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

  console.log("Seed listo: admin@gmail.com / Admin123.");
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
      purchasePrice: 650,
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
      purchasePrice: 800,
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
      purchasePrice: 950,
      utility: 180,
      brandId: apple.id,
      categoryId: laptops.id,
    },
  });

  const productAttributeValues: {
    productId: string;
    attributeId: string;
    optionId?: string;
    valueNumber?: number;
  }[] = [
    { productId: galaxyS24.id, attributeId: almacenamiento.id, optionId: alm128.id },
    { productId: galaxyS24.id, attributeId: colorCelular.id, optionId: colorNegro.id },
    { productId: galaxyS24.id, attributeId: garantia.id, valueNumber: 12 },
    { productId: iphone15.id, attributeId: almacenamiento.id, optionId: alm256.id },
    { productId: iphone15.id, attributeId: colorCelular.id, optionId: colorAzul.id },
    { productId: iphone15.id, attributeId: garantia.id, valueNumber: 12 },
    { productId: macbookAir.id, attributeId: ram.id, optionId: ram16.id },
    { productId: macbookAir.id, attributeId: garantia.id, valueNumber: 12 },
  ];

  // La unique compuesta real es (productId, attributeId, optionId) — no (productId, attributeId).
  // Prisma no deja usar null en un where compuesto (optionId "must not be null"), así que los
  // atributos sin opción (ej. "Garantía", tipo NUMBER) se resuelven a mano con findFirst + create.
  for (const value of productAttributeValues) {
    if (value.optionId) {
      await prisma.productAttributeValue.upsert({
        where: {
          productId_attributeId_optionId: {
            productId: value.productId,
            attributeId: value.attributeId,
            optionId: value.optionId,
          },
        },
        update: {},
        create: value,
      });
    } else {
      const existing = await prisma.productAttributeValue.findFirst({
        where: { productId: value.productId, attributeId: value.attributeId, optionId: null },
      });
      if (!existing) {
        await prisma.productAttributeValue.create({ data: value });
      }
    }
  }

  console.log("Catálogo de ejemplo sembrado: 3 categorías, 2 marcas, 4 atributos, 3 productos.");
}

/**
 * Todo producto sin ninguna variante (categoría sin atributo PRICED_VARIANT) necesita una variante
 * "default" para que Stock/Proformas tengan un varianteId al que atarse — ver ensureDefaultVariant en
 * product.service.ts. Acá se hace lo mismo a mano para los productos ya existentes.
 */
async function seedDefaultVariants() {
  const productos = await prisma.product.findMany({ where: { variants: { none: {} } } });
  for (const producto of productos) {
    const variantCode = await generateUniqueVariantCode();
    await prisma.productVariant.create({
      data: {
        productId: producto.id,
        variantCode,
        purchasePrice: producto.purchasePrice,
        utility: producto.utility,
        minPriceBs: producto.minPriceBs,
        discountBs: producto.discountBs,
        isDefault: true,
      },
    });
  }
  if (productos.length > 0) {
    console.log(`Variante default creada para ${productos.length} producto(s) sin variante propia.`);
  }
}

async function upsertAlmacenByNombre(nombre: string, ciudadId: string) {
  const existing = await prisma.almacen.findFirst({ where: { nombre } });
  if (existing) return existing;
  return prisma.almacen.create({ data: { nombre, ciudadId } });
}

async function seedEmpresasYAlmacenes() {
  const casaMatriz = await prisma.empresa.upsert({
    where: { nit: "J-00000001-1" },
    update: {},
    create: {
      nombre: "Aromas Caracas",
      tipo: TipoEmpresa.CASA_MATRIZ,
      razonSocial: "Aromas Caracas C.A.",
      nit: "J-00000001-1",
      logoUrl: "https://placehold.co/200x80?text=Aromas+Caracas",
    },
  });
  const sucursal = await prisma.empresa.upsert({
    where: { nit: "J-00000002-2" },
    update: {},
    create: {
      nombre: "Aromas Valencia",
      tipo: TipoEmpresa.SUCURSAL,
      razonSocial: "Aromas Valencia C.A.",
      nit: "J-00000002-2",
      logoUrl: "https://placehold.co/200x80?text=Aromas+Valencia",
    },
  });

  const caracas = await prisma.ciudad.upsert({ where: { nombre: "Caracas" }, update: {}, create: { nombre: "Caracas" } });
  const valencia = await prisma.ciudad.upsert({ where: { nombre: "Valencia" }, update: {}, create: { nombre: "Valencia" } });

  const almacenCaracas = await upsertAlmacenByNombre("Almacén Caracas", caracas.id);
  const almacenValencia = await upsertAlmacenByNombre("Almacén Valencia", valencia.id);

  console.log("2 empresas, 2 ciudades y 2 almacenes sembrados.");
  return { casaMatriz, sucursal, caracas, valencia, almacenCaracas, almacenValencia };
}

/** Deja lotes de compra + stock inicial reales, pasando una proforma de compra de punta a punta
 * (BORRADOR→...→COMPLETADA con su historial) en vez de insertar filas sueltas por fuera del flujo. */
async function seedProformaDeCompra(almacenId: string) {
  const yaSembrado = (await prisma.loteCompra.count()) > 0;
  if (yaSembrado) {
    console.log("Ya hay lotes de compra sembrados, se salta la proforma de ejemplo.");
    return;
  }

  const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: "admin@gmail.com" } });
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { nit: "J-00000001-1" } });
  const variantes = await prisma.productVariant.findMany({ take: 3, orderBy: { createdAt: "asc" } });
  if (variantes.length === 0) {
    console.log("No hay variantes todavía, se salta la proforma de compra de ejemplo.");
    return;
  }

  const proforma = await prisma.proforma.create({
    data: {
      tipo: TipoProforma.COMPRA,
      estado: EstadoProforma.COMPLETADA,
      empresaId: empresa.id,
      almacenRecepcionId: almacenId,
      creadoPorId: admin.id,
    },
  });

  for (const variante of variantes) {
    const precioCompra = Number(variante.purchasePrice) || 10;
    const costoEnvio = 1;
    const costoSeguridad = 1;
    const costoLogistica = 1;
    const cantidad = 20;
    const costoUnitario = precioCompra + costoEnvio + costoSeguridad + costoLogistica;

    const detalle = await prisma.proformaDetalle.create({
      data: {
        proformaId: proforma.id,
        varianteId: variante.id,
        cantidad,
        precioCompra,
        costoEnvio,
        costoSeguridad,
        costoLogistica,
        subtotal: cantidad * costoUnitario,
      },
    });

    await prisma.loteCompra.create({
      data: {
        varianteId: variante.id,
        almacenId,
        proformaDetalleId: detalle.id,
        costoUnitario,
        cantidadInicial: cantidad,
        cantidadDisponible: cantidad,
      },
    });

    await prisma.stock.upsert({
      where: { varianteId_almacenId: { varianteId: variante.id, almacenId } },
      update: { cantidadFisica: { increment: cantidad } },
      create: { varianteId: variante.id, almacenId, cantidadFisica: cantidad, cantidadReservada: 0 },
    });
  }

  const pasos: [EstadoProforma, string | undefined][] = [
    [EstadoProforma.BORRADOR, "Proforma creada (seed)."],
    [EstadoProforma.PENDIENTE, undefined],
    [EstadoProforma.APROBADA, undefined],
    [EstadoProforma.COMPLETADA, undefined],
  ];
  for (const [estado, nota] of pasos) {
    await prisma.proformaHistorial.create({ data: { proformaId: proforma.id, estado, usuarioId: admin.id, nota } });
  }

  console.log(`Proforma de compra de ejemplo sembrada (COMPLETADA), stock inicial en ${variantes.length} variante(s).`);
}

async function seedProformas() {
  await seedDefaultVariants();
  const { almacenCaracas } = await seedEmpresasYAlmacenes();
  await seedProformaDeCompra(almacenCaracas.id);
}

async function main() {
  await seedAuth();
  await seedCatalog();
  await seedProformas();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
