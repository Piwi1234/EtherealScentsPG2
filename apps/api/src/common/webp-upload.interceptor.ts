import { basename, dirname, extname, join, relative, sep } from "node:path";
import { unlink } from "node:fs/promises";
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";
import sharp from "sharp";
import { UPLOADS_ROOT } from "./uploads-root";
import { uploadFileToR2 } from "./r2-storage";

const CONVERTIBLE_MIME_TYPES = /^image\/(png|jpeg)$/;

/**
 * Corre después de FileInterceptor (que ya guardó el archivo original en disco vía diskStorage, ver
 * los *.multer.ts de cada módulo) — si es PNG o JPEG, lo convierte a WebP; después sube el resultado
 * (convertido o no) a R2 y borra el/los archivo(s) locales. El volumen de Railway pasa a ser solo
 * staging transitorio de la duración de este request, nunca el storage final — así no se acumula
 * nada ahí a medida que crece el catálogo (ver la charla sobre el volumen quedándose sin espacio).
 *
 * `request.file` termina con `filename` apuntando a la URL PÚBLICA COMPLETA de R2 (antes era solo el
 * nombre de archivo, y cada service armaba "/uploads/<carpeta>/" + filename a mano) — así los
 * services solo necesitan guardar `file.filename` tal cual como imageUrl/logoUrl.
 *
 * GIF queda afuera de la conversión a propósito (podría ser animado; WebP animado es otro problema
 * aparte, no resuelto acá) y WebP no necesita conversión. Si la conversión falla por algún motivo
 * (archivo corrupto, etc.), se sube el original tal cual en vez de romper la subida entera.
 */
@Injectable()
export class WebpUploadInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const file = request.file as Express.Multer.File | undefined;

    if (file?.path) {
      let finalPath = file.path;
      let contentType = file.mimetype;

      if (CONVERTIBLE_MIME_TYPES.test(file.mimetype)) {
        const newFilename = `${basename(file.filename, extname(file.filename))}.webp`;
        const newPath = join(dirname(file.path), newFilename);

        try {
          await sharp(file.path).webp({ quality: 82 }).toFile(newPath);
          await unlink(file.path).catch(() => {});
          file.filename = newFilename;
          finalPath = newPath;
          contentType = "image/webp";
        } catch {
          // Conversión fallida: seguir con el archivo original en vez de tirar abajo la subida.
        }
      }

      try {
        // Ej. "products/abc123-1699999999999.webp" — misma carpeta que ya elegía cada *.multer.ts
        // vía su *_DIR (join(UPLOADS_ROOT, "products")), ahora reusada como prefix del key en R2.
        const key = relative(UPLOADS_ROOT, finalPath).split(sep).join("/");
        file.filename = await uploadFileToR2(finalPath, key, contentType);
      } finally {
        await unlink(finalPath).catch(() => {});
      }
    }

    return next.handle();
  }
}
