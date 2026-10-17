import { extname, join } from "node:path";
import { randomInt } from "node:crypto";
import { diskStorage } from "multer";
import type { Request } from "express";
import { UPLOADS_ROOT } from "../../common/uploads-root";

export const HISTORIA_BLOQUE_IMAGES_DIR = join(UPLOADS_ROOT, "historias");

const IMAGE_MIME_TYPES = /^image\/(jpeg|png|webp|gif)$/;

// Igual criterio que carousel-image.multer.ts: se van acumulando imágenes de distintos bloques, el
// nombre solo necesita ser único, no identificar nada.
export const historiaBloqueImageMulterOptions = {
  storage: diskStorage({
    destination: HISTORIA_BLOQUE_IMAGES_DIR,
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `historia-${Date.now()}-${randomInt(1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    cb(null, IMAGE_MIME_TYPES.test(file.mimetype));
  },
};
