const DEFAULT_API_HOST = "http://localhost:4100";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_HOST;
const API_BASE = typeof window !== "undefined" && !process.env.NEXT_PUBLIC_API_URL ? "/api" : `${API_URL}/api`;

async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

  if (typeof window !== "undefined") {
    init.headers = init.headers ?? {};
    const token = localStorage.getItem("app_token");
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

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API ${response.status}: ${url} ${text}`);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, method: "GET" });
}

export function apiPost<T>(path: string, data: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}
