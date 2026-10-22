const STORAGE_KEY = "es-promo-modal-seen";

/** Cada cuánto vuelve a mostrarse el modal promocional en un mismo navegador (la misma imagen). */
export const PROMO_MODAL_COOLDOWN_MS = 2 * 60 * 60 * 1000;

type Seen = { imageUrl: string; at: number };

function readSeen(): Seen | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Seen>;
    if (typeof parsed.imageUrl === "string" && typeof parsed.at === "number") return { imageUrl: parsed.imageUrl, at: parsed.at };
    return null;
  } catch {
    // Incluye el formato viejo (solo la URL como texto, sin fecha) y localStorage no disponible
    // (ventana privada, storage bloqueado): en ambos casos se trata como "no visto todavía".
    return null;
  }
}

/** Se muestra si es una imagen distinta a la última mostrada (Gestión subió una nueva), o si ya
 * pasaron PROMO_MODAL_COOLDOWN_MS desde la última vez que se mostró. */
export function shouldShowPromoModal(imageUrl: string): boolean {
  const seen = readSeen();
  if (!seen || seen.imageUrl !== imageUrl) return true;
  return Date.now() - seen.at >= PROMO_MODAL_COOLDOWN_MS;
}

/** Se registra al MOSTRARSE (no al cerrarse): si el usuario navega sin cerrarlo, tampoco vuelve a
 * aparecer de inmediato en la visita siguiente. */
export function markPromoModalShown(imageUrl: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ imageUrl, at: Date.now() } satisfies Seen));
  } catch {
    // Ignorado a propósito — si no se puede guardar, en la próxima visita se vuelve a mostrar, no es grave.
  }
}
