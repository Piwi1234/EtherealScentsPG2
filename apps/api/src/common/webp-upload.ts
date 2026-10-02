import { basename, dirname, extname, join, relative, sep } from "node:path";
import { unlink } from "node:fs/promises";
import sharp from "sharp";
import { UPLOADS_ROOT } from "./uploads-root";
import { uploadFileToR2 } from "./r2-storage";

const CONVERTIBLE_MIME_TYPES = /^image\/(png|jpeg)$/;

/**
 * Núcleo de WebpUploadInterceptor, extraído para poder llamarlo directamente en loops (ej. import
 * masivo de imágenes por código) sin pasar por el ciclo request/response de un interceptor. Mismo
 * comportamiento: convierte PNG/JPEG a WebP, sube a R2, borra el/los archivo(s) locales, y deja
 * `file.filename` apuntando a la URL pública final de R2.
 */
export async function convertAndUploadToR2(file: Express.Multer.File): Promise<string> {
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
    const key = relative(UPLOADS_ROOT, finalPath).split(sep).join("/");
    file.filename = await uploadFileToR2(finalPath, key, contentType);
    return file.filename;
  } finally {
    await unlink(finalPath).catch(() => {});
  }
}
