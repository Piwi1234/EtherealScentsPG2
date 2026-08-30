"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LandingNavbar } from "../../../../components/landing/LandingNavbar";
import { LandingFooter } from "../../../../components/landing/LandingFooter";
import { saveCustomerSession } from "../../../../lib/customer-auth";

function GoogleCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const error = params.get("error");

  useEffect(() => {
    if (error) return;
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const id = params.get("id");
    const nombre = params.get("nombre");
    if (!accessToken || !refreshToken || !id || !nombre) return;
    saveCustomerSession(accessToken, refreshToken, { id, nombre, email: params.get("email") });
    router.replace("/cuenta");
  }, [error, params, router]);

  if (error) {
    return (
      <div className="landing-auth-card">
        <h1 className="landing-auth-title">No se pudo ingresar con Google</h1>
        <p className="landing-auth-lead">Intentá de nuevo o usá tu email y contraseña.</p>
        <p className="landing-auth-footer">
          <Link href="/ingresar">Volver a ingresar</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="landing-auth-card">
      <h1 className="landing-auth-title">Ingresando...</h1>
      <p className="landing-auth-lead">Un momento, te estamos llevando a tu cuenta.</p>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />
      <section className="landing-section landing-auth-section">
        <Suspense fallback={null}>
          <GoogleCallbackContent />
        </Suspense>
      </section>
      <LandingFooter />
    </div>
  );
}
