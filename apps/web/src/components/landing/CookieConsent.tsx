"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCookieConsent, setCookieConsent, type CookieConsentValue } from "../../lib/cookie-consent";

/**
 * Banner inferior (no modal bloqueante): no tapa el resto del sitio, se puede seguir navegando con
 * el banner visible. Se muestra una sola vez por navegador hasta que se elija Aceptar o Rechazar (ver
 * getCookieConsent, localStorage). Hoy el sitio no tiene ningún script de terceros (Analytics, Pixel)
 * que dependa de este consentimiento — si se agrega alguno más adelante, ese código debe revisar
 * getCookieConsent() antes de inicializarse, en vez de cargar siempre.
 *
 * Usa solo variables --es-* (definidas en :root), nunca --lp-* — este componente se monta como
 * hermano de {children} en CartRoot.tsx, fuera de cualquier .landing-page (cada página define las
 * --lp-* adentro suyo), así que esas variables le saldrían indefinidas acá.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getCookieConsent()) setVisible(true);
  }, []);

  function resolve(value: CookieConsentValue) {
    setCookieConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="landing-cookie-banner" role="region" aria-label="Aviso de cookies">
      <div className="landing-cookie-banner-content">
        <div className="landing-cookie-banner-text">
          <p className="landing-cookie-banner-title">Usamos cookies</p>
          <p className="landing-cookie-banner-desc">
            Usamos cookies propias para que el carrito y tu sesión funcionen correctamente. Puedes conocer más en
            nuestra{" "}
            <Link href="/politica-privacidad" className="landing-cookie-banner-link">
              Política de Privacidad
            </Link>
            .
          </p>
        </div>
        <div className="landing-cookie-banner-actions">
          <button
            type="button"
            className="landing-cookie-banner-btn landing-cookie-banner-btn--outline"
            onClick={() => resolve("rejected")}
          >
            Rechazar
          </button>
          <button
            type="button"
            className="landing-cookie-banner-btn landing-cookie-banner-btn--solid"
            onClick={() => resolve("accepted")}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
