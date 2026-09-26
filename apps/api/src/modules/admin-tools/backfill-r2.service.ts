import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { UPLOADS_ROOT } from "../../common/uploads-root";
import { uploadFileToR2 } from "../../common/r2-storage";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

interface FieldReport {
  label: string;
  migrated: { from: string; to: string }[];
  missing: string[];
  errors: { url: string; message: string }[];
}

export interface BackfillReport {
  uploaded: number;
  skipped: number;
  missing: number;
  errors: number;
  deletedLocal: number;
  details: FieldReport[];
}

/**
 * TEMPORAL — migración one-shot de imágenes que quedaron en el volumen local (de antes de pasar a
 * R2) a R2, actualizando cada fila con la URL pública completa. Pensado para correr una vez desde
 * /admin/backfill-r2-images (solo ADMIN) y después sacarse del código — no es una feature permanente.
 * Misma lógica que se usó y probó en local vía un script aparte.
 */
@Injectable()
export class BackfillR2Service {
  private readonly logger = new Logger(BackfillR2Service.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(deleteLocal: boolean): Promise<BackfillReport> {
    const report: BackfillReport = { uploaded: 0, skipped: 0, missing: 0, errors: 0, deletedLocal: 0, details: [] };

    const products = await this.prisma.product.findMany({ select: { id: true, imageUrl: true } });
    report.details.push(
      await this.migrateField(report, deleteLocal, "Product.imageUrl", products, (r) => r.imageUrl, (r, url) =>
        this.prisma.product.update({ where: { id: r.id }, data: { imageUrl: url } }),
      ),
    );

    const variants = await this.prisma.productVariant.findMany({ select: { id: true, imageUrl: true } });
    report.details.push(
      await this.migrateField(report, deleteLocal, "ProductVariant.imageUrl", variants, (r) => r.imageUrl, (r, url) =>
        this.prisma.productVariant.update({ where: { id: r.id }, data: { imageUrl: url } }),
      ),
    );

    const brands = await this.prisma.brand.findMany({ select: { id: true, logoUrl: true } });
    report.details.push(
      await this.migrateField(report, deleteLocal, "Brand.logoUrl", brands, (r) => r.logoUrl, (r, url) =>
        this.prisma.brand.update({ where: { id: r.id }, data: { logoUrl: url } }),
      ),
    );

    const empresas = await this.prisma.empresa.findMany({ select: { id: true, logoUrl: true } });
    report.details.push(
      await this.migrateField(report, deleteLocal, "Empresa.logoUrl", empresas, (r) => r.logoUrl, (r, url) =>
        this.prisma.empresa.update({ where: { id: r.id }, data: { logoUrl: url } }),
      ),
    );

    const redesSociales = await this.prisma.redSocial.findMany({ select: { id: true, logoUrl: true } });
    report.details.push(
      await this.migrateField(report, deleteLocal, "RedSocial.logoUrl", redesSociales, (r) => r.logoUrl, (r, url) =>
        this.prisma.redSocial.update({ where: { id: r.id }, data: { logoUrl: url } }),
      ),
    );

    const contactos = await this.prisma.carritoWhatsappContacto.findMany({ select: { id: true, imagenUrl: true } });
    report.details.push(
      await this.migrateField(report, deleteLocal, "CarritoWhatsappContacto.imagenUrl", contactos, (r) => r.imagenUrl, (r, url) =>
        this.prisma.carritoWhatsappContacto.update({ where: { id: r.id }, data: { imagenUrl: url } }),
      ),
    );

    const carouselImages = await this.prisma.carouselImage.findMany({ select: { id: true, imageUrl: true } });
    report.details.push(
      await this.migrateField(report, deleteLocal, "CarouselImage.imageUrl", carouselImages, (r) => r.imageUrl, (r, url) =>
        this.prisma.carouselImage.update({ where: { id: r.id }, data: { imageUrl: url } }),
      ),
    );

    const settings = await this.prisma.systemSetting.findMany({ select: { id: true, valueImageUrl: true, aboutImageUrl: true } });
    report.details.push(
      await this.migrateField(report, deleteLocal, "SystemSetting.valueImageUrl", settings, (r) => r.valueImageUrl, (r, url) =>
        this.prisma.systemSetting.update({ where: { id: r.id }, data: { valueImageUrl: url } }),
      ),
    );
    report.details.push(
      await this.migrateField(report, deleteLocal, "SystemSetting.aboutImageUrl", settings, (r) => r.aboutImageUrl, (r, url) =>
        this.prisma.systemSetting.update({ where: { id: r.id }, data: { aboutImageUrl: url } }),
      ),
    );

    return report;
  }

  private async migrateField<T>(
    report: BackfillReport,
    deleteLocal: boolean,
    label: string,
    rows: T[],
    getUrl: (row: T) => string | null,
    update: (row: T, url: string) => Promise<unknown>,
  ): Promise<FieldReport> {
    const field: FieldReport = { label, migrated: [], missing: [], errors: [] };

    for (const row of rows) {
      const url = getUrl(row);
      if (!url) {
        report.skipped++;
        continue;
      }

      // Fila migrada en una corrida anterior (o más arriba en esta misma) — la DB ya apunta a R2,
      // pero el archivo local puede seguir ahí (una corrida previa sin deleteLocal no lo borró). El
      // key de R2 espeja la ruta relativa a UPLOADS_ROOT, así que se puede reconstruir el path local
      // a partir de la URL pública para limpiarlo ahora.
      if (url.startsWith("http")) {
        report.skipped++;
        if (deleteLocal) {
          const orphanPath = this.localPathForPublicUrl(url);
          if (orphanPath && existsSync(orphanPath)) {
            await unlink(orphanPath).catch(() => {});
            report.deletedLocal++;
          }
        }
        continue;
      }

      const key = url.replace(/^\/uploads\//, "");
      const localPath = join(UPLOADS_ROOT, key);
      if (!existsSync(localPath)) {
        report.missing++;
        field.missing.push(url);
        continue;
      }

      try {
        const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
        const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
        const newUrl = await uploadFileToR2(localPath, key, contentType);
        await update(row, newUrl);
        report.uploaded++;
        field.migrated.push({ from: url, to: newUrl });

        if (deleteLocal) {
          await unlink(localPath).catch(() => {});
          report.deletedLocal++;
        }
      } catch (error) {
        report.errors++;
        const message = error instanceof Error ? error.message : String(error);
        field.errors.push({ url, message });
        this.logger.error(`Backfill R2 falló para ${url}: ${message}`);
      }
    }

    return field;
  }

  /** Inverso de uploadFileToR2: dada una URL pública ya guardada, reconstruye el path local
   * equivalente bajo UPLOADS_ROOT (mismo key, ver comentario más arriba). Null si la URL no es de
   * nuestro bucket. */
  private localPathForPublicUrl(url: string): string | null {
    const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
    const prefix = `${base}/`;
    if (!base || !url.startsWith(prefix)) return null;
    const key = url.slice(prefix.length);
    return join(UPLOADS_ROOT, key);
  }
}
