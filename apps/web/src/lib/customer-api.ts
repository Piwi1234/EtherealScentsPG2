// Cliente de API para el sitio público (cliente-auth) — paralelo a lib/api.ts (staff/gestión), pero
// chico a propósito: solo lo que hace falta para register/login/refresh/logout de cliente. El resto
// del sitio público (catálogo, marcas, etc.) sigue usando apiGet/apiPost de lib/api.ts tal cual, esos
// endpoints son públicos y no dependen de ningún token.
import { API_BASE, ApiError } from "./api";
import { clearCustomerSession } from "./customer-auth";

async function customerApiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

  if (typeof window !== "undefined") {
    init.headers = init.headers ?? {};
    const token = localStorage.getItem("customer_token");
    if (token) {
      (init.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new Error(`API request failed: ${url} — ${String(error)}`);
  }

  if (response.status === 401 && typeof window !== "undefined") {
    clearCustomerSession();
    window.location.href = "/ingresar";
    throw new ApiError(401, "Sesión expirada.");
  }

  const text = await response.text();

  if (!response.ok) {
    let message = "Ocurrió un error, intenta nuevamente";
    if (text) {
      try {
        const body = JSON.parse(text) as { message?: string | string[] };
        if (Array.isArray(body.message)) message = body.message.join(", ");
        else if (body.message) message = body.message;
      } catch {
        message = text;
      }
    }
    throw new ApiError(response.status, message);
  }

  return (text ? JSON.parse(text) : undefined) as T;
}

function customerApiPost<T>(path: string, data: unknown): Promise<T> {
  return customerApiRequest<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

export type ClienteAuthResponse = {
  accessToken: string;
  refreshToken: string;
  cliente: { id: string; nombre: string; email: string | null };
};

export function registerCustomer(data: { nombre: string; email: string; password: string; telefono?: string }) {
  return customerApiPost<ClienteAuthResponse>("/cliente-auth/register", data);
}

export function loginCustomer(email: string, password: string) {
  return customerApiPost<ClienteAuthResponse>("/cliente-auth/login", { email, password });
}

export function logoutCustomer(refreshToken: string) {
  return customerApiRequest<void>("/cliente-auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
}

/** URL de navegación real (no fetch) para el botón "Continuar con Google" — tiene que ser una
 * navegación de browser para que la cadena de redirects de Google funcione. */
export function googleAuthUrl(): string {
  return `${API_BASE}/cliente-auth/google`;
}
