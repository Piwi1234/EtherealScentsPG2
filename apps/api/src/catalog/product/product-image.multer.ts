import { extname, join } from "node:path";
import { diskStorage } from "multer";
import type { Request } from "express";
import { UPLOADS_ROOT } from "../../common/uploads-root";

export const PRODUCT_IMAGES_DIR = join(UPLOADS_ROOT, "products");

const IMAGE_MIME_TYPES = /^image\/(jpeg|png|webp|gif)$/;

export const productImageMulterOptions = {
  storage: diskStorage({
    destination: PRODUCT_IMAGES_DIR,
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const productId = req.params.id;
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${productId}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  // Rechazar tipos no permitidos antes de escribir en disco (el ParseFilePipe del controller
  // valida de nuevo para devolver un 400 con mensaje claro, esto es solo defensa temprana).
  fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    cb(null, IMAGE_MIME_TYPES.test(file.mimetype));
  },
};
