const FLASH_KEY = "app_flash_message";

/** Guarda un mensaje para mostrarlo en la próxima página (sobrevive a un router.push). */
export function setFlashMessage(message: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(FLASH_KEY, message);
}

/** Lee el mensaje pendiente (si hay) y lo borra, para que no se repita en la siguiente visita. */
export function consumeFlashMessage(): string | null {
  if (typeof window === "undefined") return null;
  const message = sessionStorage.getItem(FLASH_KEY);
  if (message) sessionStorage.removeItem(FLASH_KEY);
  return message;
}
