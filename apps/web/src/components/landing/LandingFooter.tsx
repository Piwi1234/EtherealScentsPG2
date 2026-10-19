"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_ORIGIN, apiGet, getCasaMatrizLogo } from "../../lib/api";
import { productImageSrc } from "../../lib/catalog-display";
import type { Category, ContactoInfo, RedSocial } from "../../lib/types";

// Logos subidos antes de la migración a R2 tienen logoUrl relativo ("/uploads/..."); los nuevos ya
// vienen con la URL pública completa.
function redSocialLogoSrc(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  return logoUrl.startsWith("http") ? logoUrl : `${API_ORIGIN}${logoUrl}`;
}

/** Chevron compartido por las 3 columnas desplegables — solo se ve/funciona en mobile (≤768px, ver
 * .landing-footer-col-toggle en globals.css); en desktop el contenido queda siempre visible, el botón
 * no tiene efecto visual. Mismo criterio que el acordeón de categorías del menú mobile (LandingNavbar). */
function FooterColChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`landing-footer-col-chevron${open ? " landing-footer-col-chevron--open" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Footer de todo el sitio público — trae el ancla #contacto usada por LandingNavbar. */
export function LandingFooter() {
  const [empresa, setEmpresa] = useState<{ nombre: string | null; logoUrl: string | null } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contacto, setContacto] = useState<ContactoInfo | null>(null);
  const [redes, setRedes] = useState<RedSocial[]>([]);
  // Catálogo/Contacto/Información: desplegables en mobile para no ocupar tanto alto — ver
  // .landing-footer-col-content en globals.css (display:none por default solo dentro del media
  // query de mobile, así que en desktop el contenido queda visible pase lo que pase acá).
  const [openMobileSections, setOpenMobileSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    getCasaMatrizLogo().then(setEmpresa).catch(() => {});
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    apiGet<ContactoInfo>("/settings/contacto-info").then(setContacto).catch(() => {});
    apiGet<RedSocial[]>("/redes-sociales").then(setRedes).catch(() => {});
  }, []);

  function toggleMobileSection(id: string) {
    setOpenMobileSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rootCategories = categories.filter((cat) => cat.parentId === null);
  const brandName = empresa?.nombre ?? "Ethereal Scents";
  const logoSrc = productImageSrc(empresa?.logoUrl ?? null);
  const whatsappLogoSrc = productImageSrc(contacto?.whatsappLogoUrl ?? null);

  return (
    <footer id="contacto" className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-grid">
          <div className="landing-footer-brand-col">
            {logoSrc ? (
              <img className="landing-footer-logo" src={logoSrc} alt={brandName} />
            ) : (
              <p className="landing-footer-brand">{brandName}</p>
            )}
            <p className="landing-footer-tagline">Una experiencia más allá del aroma</p>
          </div>
          <div className="landing-footer-col">
            <button
              type="button"
              className="landing-footer-col-toggle"
              aria-expanded={openMobileSections.has("catalogo")}
              onClick={() => toggleMobileSection("catalogo")}
            >
              <span className="landing-footer-col-title">Catálogo</span>
              <FooterColChevron open={openMobileSections.has("catalogo")} />
            </button>
            <div className={`landing-footer-col-content${openMobileSections.has("catalogo") ? " landing-footer-col-content--open" : ""}`}>
              {rootCategories.map((cat) => (
                <Link key={cat.id} href={`/categoria/${cat.slug}`}>
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="landing-footer-col">
            <button
              type="button"
              className="landing-footer-col-toggle"
              aria-expanded={openMobileSections.has("contacto")}
              onClick={() => toggleMobileSection("contacto")}
            >
              <span className="landing-footer-col-title">Contacto</span>
              <FooterColChevron open={openMobileSections.has("contacto")} />
            </button>
            <div className={`landing-footer-col-content${openMobileSections.has("contacto") ? " landing-footer-col-content--open" : ""}`}>
              {contacto?.telefonos.map((tel) => (
                <a
                  key={tel}
                  className="landing-footer-telefono"
                  href={`https://wa.me/${tel.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {whatsappLogoSrc && <img className="landing-footer-whatsapp-icon" src={whatsappLogoSrc} alt="WhatsApp" />}
                  {tel}
                </a>
              ))}
              {contacto?.email && <p>{contacto.email}</p>}
              {contacto?.ciudad && <p>{contacto.ciudad}</p>}
            </div>
          </div>
          {/* Solo mobile (ver .landing-footer-col--mobile-only) — en desktop "Política de Privacidad"
              ya está en .landing-footer-bottom, no hace falta una columna aparte para eso. */}
          <div className="landing-footer-col landing-footer-col--mobile-only">
            <button
              type="button"
              className="landing-footer-col-toggle"
              aria-expanded={openMobileSections.has("informacion")}
              onClick={() => toggleMobileSection("informacion")}
            >
              <span className="landing-footer-col-title">Información</span>
              <FooterColChevron open={openMobileSections.has("informacion")} />
            </button>
            <div className={`landing-footer-col-content${openMobileSections.has("informacion") ? " landing-footer-col-content--open" : ""}`}>
              <Link href="/politica-privacidad">Política de Privacidad</Link>
            </div>
          </div>
          {redes.length > 0 && (
            <div className="landing-footer-col">
              <p className="landing-footer-col-title">Síguenos</p>
              <div className="landing-footer-social">
                {redes.map((red) =>
                  redSocialLogoSrc(red.logoUrl) ? (
                    <a key={red.id} href={red.url} target="_blank" rel="noopener noreferrer" aria-label={red.nombre}>
                      <img src={redSocialLogoSrc(red.logoUrl)!} alt={red.nombre} />
                    </a>
                  ) : null,
                )}
              </div>
            </div>
          )}
        </div>
        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} {brandName}. Todos los derechos reservados.</span>
          {/* En mobile ya está en el desplegable "Información" de arriba — se oculta acá para no
              repetirlo (ver .landing-footer-bottom-privacy en globals.css). */}
          <Link href="/politica-privacidad" className="landing-footer-bottom-privacy">
            Política de Privacidad
          </Link>
        </div>
      </div>
    </footer>
  );
}
