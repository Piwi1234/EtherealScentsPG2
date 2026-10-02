import { basename, extname } from "node:path";
import { unlink } from "node:fs/promises";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { convertAndUploadToR2 } from "../../common/webp-upload";
import { deleteFromR2 } from "../../common/r2-storage";

export interface ProductImageImportUnmatched {
  fileName: string;
  code: string;
}

export interface ProductImageImportError {
  fileName: string;
  message: string;
}

export interface ProductImageImportReport {
  total: number;
  updated: number;
  unmatched: ProductImageImportUnmatched[];
  errors: ProductImageImportError[];
}

@Injectable()
export class ProductImageImportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cada archivo llega nombrado como el código del producto (ej. "A1B2C3D.jpg") — el matching es
   * por ese nombre, no por el nombre único que le asignó el diskStorage (ver *.multer.ts). */
  async importFromFiles(files: Express.Multer.File[]): Promise<ProductImageImportReport> {
    const report: ProductImageImportReport = { total: files.length, updated: 0, unmatched: [], errors: [] };

    for (const file of files) {
      const code = basename(file.originalname, extname(file.originalname)).trim();

      try {
        const product = await this.prisma.product.findFirst({
          where: { productCode: { equals: code, mode: "insensitive" } },
          select: { id: true, imageUrl: true },
        });

        if (!product) {
          report.unmatched.push({ fileName: file.originalname, code });
          await unlink(file.path).catch(() => {});
          continue;
        }

        const url = await convertAndUploadToR2(file);
        await this.prisma.product.update({ where: { id: product.id }, data: { imageUrl: url } });

        if (product.imageUrl) {
          await deleteFromR2(product.imageUrl).catch(() => {});
        }

        report.updated += 1;
      } catch (error) {
        report.errors.push({ fileName: file.originalname, message: error instanceof Error ? error.message : "Error desconocido" });
        await unlink(file.path).catch(() => {});
      }
    }

    return report;
  }
}
