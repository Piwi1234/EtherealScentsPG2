import { extname } from "node:path";
import { diskStorage } from "multer";
import type { Request } from "express";
import { PRODUCT_IMAGES_DIR } from "./product-image.multer";

const IMAGE_MIME_TYPES = /^image\/(jpeg|png|webp|gif)$/;

// Comparte carpeta con las imágenes de producto (ya la crea main.ts al arrancar) — el prefijo
// "variant-" alcanza para no chocar con los archivos "{productId}-{timestamp}.ext" del producto.
export const productVariantImageMulterOptions = {
  storage: diskStorage({
    destination: PRODUCT_IMAGES_DIR,
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const variantId = req.params.variantId;
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `variant-${variantId}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    cb(null, IMAGE_MIME_TYPES.test(file.mimetype));
  },
};
