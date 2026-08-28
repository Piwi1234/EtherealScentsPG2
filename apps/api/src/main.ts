import "reflect-metadata";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  // Carpetas de imágenes: deben existir antes de que multer/estáticos las usen.
  mkdirSync(join(process.cwd(), "uploads", "products"), { recursive: true });
  mkdirSync(join(process.cwd(), "uploads", "empresas"), { recursive: true });
  mkdirSync(join(process.cwd(), "uploads", "brands"), { recursive: true });
  mkdirSync(join(process.cwd(), "uploads", "categories"), { recursive: true });
  mkdirSync(join(process.cwd(), "uploads", "landing"), { recursive: true });
  mkdirSync(join(process.cwd(), "uploads", "carousel"), { recursive: true });
  mkdirSync(join(process.cwd(), "uploads", "carrito-whatsapp"), { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads" });
  // Express 5 cambió el parser de query por defecto a "simple" (querystring nativo), que no
  // entiende notación de corchetes. La volvemos a "extended" (qs) para poder recibir filtros
  // dinámicos de catálogo como `?attr[<attributeId>]=valor`.
  app.set("query parser", "extended");
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3100",
    credentials: true,
  });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Nuevo Proyecto API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));

  await app.listen(Number(process.env.PORT ?? 4100));
}

void bootstrap();
