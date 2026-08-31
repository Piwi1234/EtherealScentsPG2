import { extname, join } from "node:path";
import { diskStorage } from "multer";
import type { Request } from "express";
import { UPLOADS_ROOT } from "../../common/uploads-root";

export const RED_SOCIAL_LOGOS_DIR = join(UPLOADS_ROOT, "redes-sociales");

const IMAGE_MIME_TYPES = /^image\/(jpeg|png|webp|gif)$/;

export const redSocialLogoMulterOptions = {
  storage: diskStorage({
    destination: RED_SOCIAL_LOGOS_DIR,
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const redSocialId = req.params.id;
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${redSocialId}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  // Rechazar tipos no permitidos antes de escribir en disco (el controller valida de nuevo para
  // devolver un 400 con mensaje claro, esto es solo defensa temprana).
  fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    cb(null, IMAGE_MIME_TYPES.test(file.mimetype));
  },
};
