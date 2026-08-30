// Sesión de cliente (sitio público) — paralela a lib/auth.ts (sesión de staff/gestión), con sus
// propias claves de localStorage y su propia cookie, para que ninguna de las dos pueda pisar ni
// limpiar a la otra (un mismo browser puede tener una sesión de staff y una de cliente a la vez).
export type CustomerUser = { id: string; nombre: string; email: string | null };

export function saveCustomerSession(accessToken: string, refreshToken: string, user: CustomerUser) {
  localStorage.setItem("customer_token", accessToken);
  localStorage.setItem("customer_refresh_token", refreshToken);
  localStorage.setItem("customer_user", JSON.stringify(user));
  document.cookie = `customer_token=${accessToken}; path=/`;
}

export function getCustomerUser(): CustomerUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("customer_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomerUser;
  } catch {
    return null;
  }
}

export function clearCustomerSession() {
  localStorage.removeItem("customer_token");
  localStorage.removeItem("customer_refresh_token");
  localStorage.removeItem("customer_user");
  document.cookie = "customer_token=; path=/; max-age=0";
}
