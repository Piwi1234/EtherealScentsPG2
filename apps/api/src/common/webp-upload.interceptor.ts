import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";
import { convertAndUploadToR2 } from "./webp-upload";

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
 * La lógica de conversión+subida vive en convertAndUploadToR2 (webp-upload.ts) para poder llamarla
 * también fuera de un interceptor (ej. import masivo de imágenes por código).
 */
@Injectable()
export class WebpUploadInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const file = request.file as Express.Multer.File | undefined;

    if (file?.path) {
      await convertAndUploadToR2(file);
    }

    return next.handle();
  }
}
