import { extname, join } from "node:path";
import { randomInt } from "node:crypto";
import { diskStorage } from "multer";
import type { Request } from "express";
import { UPLOADS_ROOT } from "../../common/uploads-root";

export const CAROUSEL_IMAGES_DIR = join(UPLOADS_ROOT, "carousel");

const IMAGE_MIME_TYPES = /^image\/(jpeg|png|webp|gif)$/;

// A diferencia de logo/imagen-única (donde el nombre incluye el id de la entidad, ya conocido de
// antemano), acá se van acumulando varias imágenes por carrusel — el nombre solo necesita ser
// único, no identificar nada.
export const carouselImageMulterOptions = {
  storage: diskStorage({
    destination: CAROUSEL_IMAGES_DIR,
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `carousel-${Date.now()}-${randomInt(1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  // Rechazar tipos no permitidos antes de escribir en disco (el controller valida de nuevo para
  // devolver un 400 con mensaje claro, esto es solo defensa temprana).
  fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    cb(null, IMAGE_MIME_TYPES.test(file.mimetype));
  },
};
