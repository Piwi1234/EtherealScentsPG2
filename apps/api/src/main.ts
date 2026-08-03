import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Express 5 cambió el parser de query por defecto a "simple" (querystring nativo), que no
  // entiende notación de corchetes. La volvemos a "extended" (qs) para poder recibir filtros
  // dinámicos de catálogo como `?attr[<attributeId>]=valor`.
  app.set("query parser", "extended");
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3100",
    credentials: true,
  });
  app.setGlobalPrefix("api");
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
