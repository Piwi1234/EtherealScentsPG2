import { extname, join } from "node:path";
import { diskStorage } from "multer";
import type { Request } from "express";

export const LANDING_IMAGES_DIR = join(process.cwd(), "uploads", "landing");

const IMAGE_MIME_TYPES = /^image\/(jpeg|png|webp|gif)$/;

export function landingImageMulterOptions(slot: "value" | "about") {
  return {
    storage: diskStorage({
      destination: LANDING_IMAGES_DIR,
      filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        const ext = extname(file.originalname).toLowerCase();
        cb(null, `${slot}-${Date.now()}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    // Rechazar tipos no permitidos antes de escribir en disco (el controller valida de nuevo para
    // devolver un 400 con mensaje claro, esto es solo defensa temprana).
    fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
      cb(null, IMAGE_MIME_TYPES.test(file.mimetype));
    },
  };
}
