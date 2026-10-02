import { extname } from "node:path";
import { randomInt } from "node:crypto";
import { diskStorage } from "multer";
import type { Request } from "express";
import { PRODUCT_IMAGES_DIR } from "./product-image.multer";

const IMAGE_MIME_TYPES = /^image\/(jpeg|png|webp|gif)$/;

// Igual que carouselImageMulterOptions: no hay un id de entidad conocido de antemano (el matching
// por productCode pasa después, en el service, leyendo file.originalname). El nombre en disco solo
// necesita ser único y no pisar al archivo original guardado por otro upload concurrente.
export const productImageImportMulterOptions = {
  storage: diskStorage({
    destination: PRODUCT_IMAGES_DIR,
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `import-${Date.now()}-${randomInt(1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 300 },
  fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    cb(null, IMAGE_MIME_TYPES.test(file.mimetype));
  },
};
