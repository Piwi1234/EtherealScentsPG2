"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { clearCustomerSession, getCustomerUser, type CustomerUser } from "../../lib/customer-auth";
import { logoutCustomer } from "../../lib/customer-api";

export default function CuentaPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setCustomer(getCustomerUser());
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    const refreshToken = localStorage.getItem("customer_refresh_token");
    try {
      if (refreshToken) await logoutCustomer(refreshToken);
    } catch {
      // Si el refresh token ya estaba vencido/revocado, igual limpiamos la sesión local abajo.
    }
    clearCustomerSession();
    router.push("/home");
  }

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <section className="landing-section landing-auth-section">
        <div className="landing-auth-card">
          <h1 className="landing-auth-title">Mi cuenta</h1>
          {customer ? (
            <>
              <p className="landing-auth-lead">
                Hola, {customer.nombre}
                {customer.email ? ` — ${customer.email}` : ""}
              </p>
              <button type="button" className="landing-btn landing-btn-primary landing-auth-submit" onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
              </button>
            </>
          ) : (
            <p className="landing-auth-lead">Cargando...</p>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
