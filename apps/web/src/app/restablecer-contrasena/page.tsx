"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { resetPassword } from "../../lib/customer-api";
import { ApiError } from "../../lib/api";

function RestablecerContrasenaContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (password.length < 8) {
      setError("La contraseña tiene que tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!token) return;

    setLoading(true);
    setError("");
    try {
      await resetPassword(token, password);
      router.push("/ingresar");
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? "El link expiró o ya fue usado. Pedí uno nuevo."
          : "Error de conexión, intentá de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="landing-auth-card">
        <h1 className="landing-auth-title">Link inválido</h1>
        <p className="landing-auth-lead">Este link no es válido. Pedí uno nuevo.</p>
        <p className="landing-auth-footer">
          <Link href="/olvide-contrasena">Pedir un link nuevo</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="landing-auth-card">
      <h1 className="landing-auth-title">Elegí una contraseña nueva</h1>

      {error && <p className="landing-auth-error">{error}</p>}

      <div className="landing-auth-field">
        <label htmlFor="reset-password">Contraseña nueva</label>
        <input
          id="reset-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      <div className="landing-auth-field">
        <label htmlFor="reset-confirm">Confirmar contraseña</label>
        <input
          id="reset-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="••••••••"
        />
      </div>

      <button type="button" className="landing-btn landing-btn-primary landing-auth-submit" onClick={submit} disabled={loading}>
        {loading ? "Guardando..." : "Guardar contraseña"}
      </button>
    </div>
  );
}

export default function RestablecerContrasenaPage() {
  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />
      <section className="landing-section landing-auth-section">
        <Suspense fallback={null}>
          <RestablecerContrasenaContent />
        </Suspense>
      </section>
      <LandingFooter />
    </div>
  );
}
