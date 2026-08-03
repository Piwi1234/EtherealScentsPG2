"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "../../lib/api";
import { saveSession } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await apiPost<{ accessToken: string; user: any }>("/auth/login", { email, password });
      saveSession(res.accessToken, res.user);
      router.push("/dashboard");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message.includes("401") ? "Credenciales inválidas." : `Error de conexión: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ width: 360 }}>
        <h1 style={{ marginTop: 0, fontSize: 20 }}>Iniciar sesión</h1>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label>Email</label>
            <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label>Contraseña</label>
            <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
          <button className="button" type="button" onClick={submit} disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </div>
      </div>
    </div>
  );
}
