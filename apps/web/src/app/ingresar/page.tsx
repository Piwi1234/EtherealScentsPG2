"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { loginCustomer, googleAuthUrl } from "../../lib/customer-api";
import { saveCustomerSession } from "../../lib/customer-auth";
import { ApiError } from "../../lib/api";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.66Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3.02c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z" />
    </svg>
  );
}

export default function IngresarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await loginCustomer(email, password);
      saveCustomerSession(res.accessToken, res.refreshToken, res.cliente);
      router.push("/cuenta");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? "Email o contraseña incorrectos." : "Error de conexión, intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <section className="landing-section landing-auth-section">
        <div className="landing-auth-card">
          <h1 className="landing-auth-title">Ingresar</h1>
          <p className="landing-auth-lead">Entrá con tu cuenta para ver tu perfil y tus pedidos.</p>

          {error && <p className="landing-auth-error">{error}</p>}

          <div className="landing-auth-field">
            <label htmlFor="ingresar-email">Email</label>
            <input
              id="ingresar-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </div>
          <div className="landing-auth-field">
            <label htmlFor="ingresar-password">Contraseña</label>
            <input
              id="ingresar-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="••••••••"
            />
          </div>

          <p className="landing-auth-forgot">
            <Link href="/olvide-contrasena">¿Olvidaste tu contraseña?</Link>
          </p>

          <button type="button" className="landing-btn landing-btn-primary landing-auth-submit" onClick={submit} disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          <div className="landing-auth-divider">o</div>

          <a className="landing-auth-google" href={googleAuthUrl()}>
            <GoogleIcon />
            Continuar con Google
          </a>

          <p className="landing-auth-footer">
            ¿No tenés cuenta? <Link href="/registro">Registrate</Link>
          </p>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
