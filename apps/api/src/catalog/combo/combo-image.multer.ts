import { extname, join } from "node:path";
import { diskStorage } from "multer";
import type { Request } from "express";
import { UPLOADS_ROOT } from "../../common/uploads-root";

export const COMBO_IMAGES_DIR = join(UPLOADS_ROOT, "combos");

const IMAGE_MIME_TYPES = /^image\/(jpeg|png|webp|gif)$/;

export const comboImageMulterOptions = {
  storage: diskStorage({
    destination: COMBO_IMAGES_DIR,
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      cb(null, `${req.params.id}-${Date.now()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    cb(null, IMAGE_MIME_TYPES.test(file.mimetype));
  },
};
