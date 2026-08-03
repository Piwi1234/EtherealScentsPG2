export type AuthUser = { id: string; email: string; name: string; firstName: string; lastName: string; role: string };

export function saveSession(token: string, user: AuthUser) {
  localStorage.setItem("app_token", token);
  localStorage.setItem("app_user", JSON.stringify(user));
  document.cookie = `app_token=${token}; path=/`;
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("app_user");
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function clearSession() {
  localStorage.removeItem("app_token");
  localStorage.removeItem("app_user");
  document.cookie = "app_token=; path=/; max-age=0";
}
