import { basename, dirname, extname, join } from "node:path";
import { unlink } from "node:fs/promises";
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";
import sharp from "sharp";

const CONVERTIBLE_MIME_TYPES = /^image\/(png|jpeg)$/;

/**
 * Corre después de FileInterceptor (que ya guardó el archivo original en disco vía diskStorage,
 * ver los *.multer.ts de cada módulo) — si es PNG o JPEG, lo convierte a WebP y reemplaza
 * request.file para que apunte al archivo nuevo, así el resto del código (controllers/services)
 * sigue usando file.filename como si nada hubiera cambiado.
 *
 * GIF queda afuera a propósito (podría ser animado; WebP animado es otro problema aparte, no
 * resuelto acá) y WebP no necesita conversión. Si la conversión falla por algún motivo (archivo
 * corrupto, etc.), se deja el original tal cual en vez de romper la subida entera.
 */
@Injectable()
export class WebpUploadInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const file = request.file as Express.Multer.File | undefined;

    if (file?.path && CONVERTIBLE_MIME_TYPES.test(file.mimetype)) {
      const newFilename = `${basename(file.filename, extname(file.filename))}.webp`;
      const newPath = join(dirname(file.path), newFilename);

      try {
        await sharp(file.path).webp({ quality: 82 }).toFile(newPath);
        await unlink(file.path).catch(() => {});
        file.filename = newFilename;
        file.path = newPath;
        file.mimetype = "image/webp";
      } catch {
        // Conversión fallida: seguir con el archivo original en vez de tirar abajo la subida.
      }
    }

    return next.handle();
  }
}
