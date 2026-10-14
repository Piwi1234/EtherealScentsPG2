const STORAGE_KEY = "ethereal-scents-cookie-consent";

export type CookieConsentValue = "accepted" | "rejected";

/** null = todavía no eligió (el modal lo vuelve a preguntar). */
export function getCookieConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "accepted" || raw === "rejected" ? raw : null;
}

export function setCookieConsent(value: CookieConsentValue) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, value);
}
