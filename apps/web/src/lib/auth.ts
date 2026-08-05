export type AuthUser = { id: string; nombre: string; email: string; rol: "ADMIN" | "SELLER" };

export function saveSession(accessToken: string, refreshToken: string, user: AuthUser) {
  localStorage.setItem("app_token", accessToken);
  localStorage.setItem("app_refresh_token", refreshToken);
  localStorage.setItem("app_user", JSON.stringify(user));
  document.cookie = `app_token=${accessToken}; path=/`;
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("app_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("app_token");
  localStorage.removeItem("app_refresh_token");
  localStorage.removeItem("app_user");
  document.cookie = "app_token=; path=/; max-age=0";
}
