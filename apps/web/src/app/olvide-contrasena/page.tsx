"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { forgotPassword } from "../../lib/customer-api";

export default function OlvideContrasenaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      // El backend siempre responde igual exista o no el email — nunca hay que revelar si una
      // cuenta existe, así que acá tampoco se distingue éxito/error de negocio, solo se muestra
      // el mismo mensaje genérico.
      await forgotPassword(email);
    } catch {
      // Ídem: un error de red no debería cambiar lo que ve el usuario acá.
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <section className="landing-section landing-auth-section">
        <div className="landing-auth-card">
          <h1 className="landing-auth-title">Olvidé mi contraseña</h1>

          {sent ? (
            <>
              <p className="landing-auth-lead">
                Si <strong>{email}</strong> tiene una cuenta con nosotros, te mandamos un email con un link para
                elegir una contraseña nueva. Revisá también la carpeta de spam.
              </p>
              <p className="landing-auth-footer">
                <Link href="/ingresar">Volver a ingresar</Link>
              </p>
            </>
          ) : (
            <>
              <p className="landing-auth-lead">Ingresá tu email y te mandamos un link para restablecerla.</p>

              <div className="landing-auth-field">
                <label htmlFor="olvide-email">Email</label>
                <input
                  id="olvide-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && email.trim() && submit()}
                  placeholder="tu@email.com"
                />
              </div>

              <button
                type="button"
                className="landing-btn landing-btn-primary landing-auth-submit"
                onClick={submit}
                disabled={loading || !email.trim()}
              >
                {loading ? "Enviando..." : "Enviar link"}
              </button>

              <p className="landing-auth-footer">
                <Link href="/ingresar">Volver a ingresar</Link>
              </p>
            </>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
