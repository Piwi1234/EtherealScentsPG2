"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiPost } from "../../lib/api";
import { saveSession, type AuthUser } from "../../lib/auth";

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

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
      const res = await apiPost<{ accessToken: string; refreshToken: string; usuario: AuthUser }>("/auth/login", { email, password });
      saveSession(res.accessToken, res.refreshToken, res.usuario);
      router.push("/dashboard");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("Credenciales inválidas.");
      } else {
        const message = e instanceof Error ? e.message : String(e);
        setError(`Error de conexión: ${message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* <form> real + name/autocomplete: sin esto el llavero de iOS (y los gestores de contraseñas) no ofrecen guardar ni autocompletar. */}
      <form
        className="login-card"
        method="post"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <img className="login-logo" src="/logo-e.png" alt="Ethereal Scents" />
        <div className="login-badge">Iniciar sesión</div>

        <div className="login-field">
          <label htmlFor="login-email" className="sr-only">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
          <span className="login-field-icon">
            <UserIcon />
          </span>
        </div>

        <div className="login-field">
          <label htmlFor="login-pass" className="sr-only">Contraseña</label>
          <input
            id="login-pass"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
          />
          <span className="login-field-icon">
            <LockIcon />
          </span>
        </div>

        {error && <p className="login-error">{error}</p>}

        <button className="login-submit" type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
