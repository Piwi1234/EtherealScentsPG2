"use client";

import { useEffect, useState } from "react";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { apiGet, getCasaMatrizLogo } from "../../lib/api";
import type { ContactoInfo } from "../../lib/types";

export default function PoliticaPrivacidadPage() {
  const [empresa, setEmpresa] = useState<{ nombre: string | null } | null>(null);
  const [contacto, setContacto] = useState<ContactoInfo | null>(null);

  useEffect(() => {
    getCasaMatrizLogo().then(setEmpresa).catch(() => {});
    apiGet<ContactoInfo>("/settings/contacto-info").then(setContacto).catch(() => {});
  }, []);

  const brandName = empresa?.nombre ?? "Ethereal Scents";

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <section className="landing-section landing-section--faq-dark">
        <div className="landing-container">
          <p className="landing-eyebrow">Legal</p>
          <h1 className="landing-section-title">Política de Privacidad</h1>
          <p className="landing-section-lead">
            Cómo recolectamos, usamos y protegemos tus datos en {brandName}.
          </p>

          <div className="landing-faq">
            <div className="landing-faq-group">
              <h2 className="landing-faq-group-title">Qué datos recolectamos</h2>
              <p className="landing-faq-answer">
                Cuando creás una cuenta (con email y contraseña, o con &quot;Continuar con Google&quot;) guardamos tu
                nombre, tu email y, si lo indicás, tu teléfono. Si te registrás con Google, solo recibimos tu
                nombre y email públicos de tu cuenta de Google — nunca tu contraseña de Google.
              </p>
              <p className="landing-faq-answer">
                Si nos pedís una cotización o realizás un pedido, también podemos guardar tu dirección y ciudad
                para coordinar la entrega.
              </p>
              <p className="landing-faq-answer">
                El carrito de compras se guarda únicamente en tu propio navegador (no en nuestros servidores)
                hasta que confirmás un pedido.
              </p>
            </div>

            <div className="landing-faq-group">
              <h2 className="landing-faq-group-title">Cómo usamos tus datos</h2>
              <p className="landing-faq-answer">
                Usamos tus datos para gestionar tu cuenta, procesar cotizaciones y pedidos, coordinar envíos, y
                contactarte por consultas relacionadas con tu compra. No usamos tus datos para fines distintos a
                estos.
              </p>
            </div>

            <div className="landing-faq-group">
              <h2 className="landing-faq-group-title">Con quién compartimos tus datos</h2>
              <p className="landing-faq-answer">
                No vendemos ni compartimos tus datos con terceros con fines comerciales. Si iniciás sesión con
                Google, Google procesa la autenticación según su propia política de privacidad. Tus datos de
                contacto y envío se comparten solo con quien coordina la entrega de tu pedido.
              </p>
            </div>

            <div className="landing-faq-group">
              <h2 className="landing-faq-group-title">Seguridad</h2>
              <p className="landing-faq-answer">
                Tu contraseña nunca se guarda en texto plano — se almacena encriptada (hash). Todas las
                conexiones a nuestro sitio viajan cifradas (HTTPS).
              </p>
            </div>

            <div className="landing-faq-group">
              <h2 className="landing-faq-group-title">Tus derechos</h2>
              <p className="landing-faq-answer">
                Podés pedirnos acceder, corregir o eliminar tus datos personales en cualquier momento
                escribiéndonos a los medios de contacto de abajo.
              </p>
            </div>

            <div className="landing-faq-group">
              <h2 className="landing-faq-group-title">Cambios a esta política</h2>
              <p className="landing-faq-answer">
                Podemos actualizar esta política ocasionalmente. Los cambios importantes se van a reflejar en
                esta misma página.
              </p>
            </div>
          </div>

          <p className="landing-faq-footer">
            ¿Preguntas sobre tus datos?{" "}
            {contacto?.email ? <a href={`mailto:${contacto.email}`}>{contacto.email}</a> : <a href="#contacto">Contactanos</a>}
            .
          </p>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
