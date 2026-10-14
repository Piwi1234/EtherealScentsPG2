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

const PRODUCTS_LIST_QUERY_KEY = "products_list_query";

/** Guarda el query string de filtros activos del listado de Productos (dashboard/products/page.tsx
 * lo llama cada vez que cambian) — así "Guardar" en Nuevo/Editar producto puede volver a esos mismos
 * filtros en vez de a la lista en blanco. A diferencia de consumeFlashMessage, no se borra al leerlo:
 * no es un evento de una sola vez, el listado lo sigue actualizando mientras esté montado. */
export function setProductsListQuery(query: string) {
  if (typeof window === "undefined") return;
  if (query) sessionStorage.setItem(PRODUCTS_LIST_QUERY_KEY, query);
  else sessionStorage.removeItem(PRODUCTS_LIST_QUERY_KEY);
}

export function getProductsListQuery(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(PRODUCTS_LIST_QUERY_KEY) ?? "";
}
