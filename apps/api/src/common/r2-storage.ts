import { readFile } from "node:fs/promises";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Utilidad standalone (sin DI), mismo criterio que uploads-root.ts: lee todo de process.env directo
// en vez de un ConfigService inyectado, así se puede usar tanto desde servicios como desde
// WebpUploadInterceptor (que se registra a mano en @UseInterceptors, sin pasar por el container).
//
// El cliente se arma recién en el primer uso (no al importar el módulo): Nest hace require() de
// TODOS los archivos del proyecto para armar el grafo de DI antes de que ConfigModule.forRoot()
// llegue a cargar el .env — si el S3Client se construyera al importar este archivo, las credenciales
// todavía serían undefined en ese momento (el endpoint salía "https://undefined.r2..." y explotaba
// con un SSL handshake failure bastante críptico).
let client: S3Client | undefined;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return client;
}

function getPublicUrlBase(): string {
  return (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
}

/**
 * Sube un archivo ya escrito en disco (staging transitorio de multer/WebpUploadInterceptor — el
 * volumen local de Railway dejó de ser el storage final, ver ese interceptor) a R2 bajo `key` y
 * devuelve la URL pública completa. Esa URL completa es lo que se guarda en imageUrl/logoUrl de acá
 * en adelante, a diferencia de la ruta relativa "/uploads/..." de antes de esta migración.
 */
export async function uploadFileToR2(localPath: string, key: string, contentType: string): Promise<string> {
  const body = await readFile(localPath);
  await getClient().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: body, ContentType: contentType }));
  return `${getPublicUrlBase()}/${key}`;
}

/**
 * Borra el objeto de R2 correspondiente a una imageUrl/logoUrl ya guardada — mismo uso best-effort
 * (`.catch(() => {})` en el caller) que el unlink() que reemplaza. No-op silencioso si la URL no es
 * de nuestro bucket: cubre datos de antes de la migración (rutas relativas "/uploads/...", todavía
 * sin backfillear) sin que cada caller tenga que distinguir el caso.
 */
export async function deleteFromR2(imageUrl: string): Promise<void> {
  const prefix = `${getPublicUrlBase()}/`;
  if (!imageUrl.startsWith(prefix)) return;
  const key = imageUrl.slice(prefix.length);
  await getClient().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}
