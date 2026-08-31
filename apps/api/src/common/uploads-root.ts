import { join } from "node:path";

/** Base de "uploads/". El cwd del proceso en producción no es confiable (depende de cómo el
 * host invoque el start command, ej. "pnpm --filter" cambia el cwd al del paquete) — por eso es
 * configurable vía UPLOADS_DIR para apuntar directo a un volumen persistente montado en un path
 * absoluto conocido. Sin esa variable, cae a process.cwd()/uploads como siempre (dev local). */
export const UPLOADS_ROOT = process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads");
