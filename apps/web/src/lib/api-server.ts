import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "./api";

const DEFAULT_API_HOST = "http://localhost:4100";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_HOST;

/**
 * Fetch para Server Components: lee el access token de la cookie `app_token` (la misma que ya usa
 * el middleware para proteger /dashboard) en vez de localStorage, que no existe en el servidor.
 */
export async function apiGetServer<T>(path: string): Promise<T> {
  const token = (await cookies()).get("app_token")?.value;

  const response = await fetch(`${API_URL}/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/login");
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
