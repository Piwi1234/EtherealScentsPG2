const STORAGE_KEY = "es-promo-modal-seen";

/** Qué imagen del modal promocional ya se mostró en este navegador — se guarda la URL de la imagen
 * (no un simple true/false) para que, si Gestión sube una imagen nueva, el modal vuelva a mostrarse
 * solo, sin tener que "resetear" nada a mano. try/catch porque localStorage puede no estar
 * disponible (ventana privada, storage bloqueado). */
export function hasSeenPromoModal(imageUrl: string): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === imageUrl;
  } catch {
    return false;
  }
}

export function markPromoModalSeen(imageUrl: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, imageUrl);
  } catch {
    // Ignorado a propósito — si no se puede guardar, en la próxima visita se vuelve a mostrar, no es grave.
  }
}
