import { memoryStorage } from "multer";
import type { Request } from "express";

const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// En memoria (no diskStorage): el archivo solo se necesita para parsearlo, no queda nada que servir
// después.
export const productImportMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    cb(null, file.mimetype === XLSX_MIME_TYPE);
  },
};
