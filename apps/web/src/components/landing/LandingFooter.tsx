"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_ORIGIN, apiGet, getCasaMatrizLogo } from "../../lib/api";
import type { Category, ContactoInfo, RedSocial } from "../../lib/types";

function redSocialLogoSrc(logoUrl: string | null): string | null {
  return logoUrl ? `${API_ORIGIN}${logoUrl}` : null;
}

/** Footer de todo el sitio público — trae el ancla #contacto usada por LandingNavbar. */
export function LandingFooter() {
  const [empresa, setEmpresa] = useState<{ nombre: string | null } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contacto, setContacto] = useState<ContactoInfo | null>(null);
  const [redes, setRedes] = useState<RedSocial[]>([]);

  useEffect(() => {
    getCasaMatrizLogo().then(setEmpresa).catch(() => {});
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    apiGet<ContactoInfo>("/settings/contacto-info").then(setContacto).catch(() => {});
    apiGet<RedSocial[]>("/redes-sociales").then(setRedes).catch(() => {});
  }, []);

  const rootCategories = categories.filter((cat) => cat.parentId === null);
  const brandName = empresa?.nombre ?? "Ethereal Scents";

  return (
    <footer id="contacto" className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-grid">
          <div>
            <p className="landing-footer-brand">{brandName}</p>
            <p className="landing-footer-tagline">Todo lo que necesitas en un solo lugar.</p>
          </div>
          <div className="landing-footer-col">
            <p className="landing-footer-col-title">Catálogo</p>
            {rootCategories.map((cat) => (
              <Link key={cat.id} href={`/categoria/${cat.slug}`}>
                {cat.name}
              </Link>
            ))}
            <Link href="/dashboard">Gestión</Link>
          </div>
          <div className="landing-footer-col">
            <p className="landing-footer-col-title">Contacto</p>
            {contacto?.telefonos?.split("\n").map((tel, i) => tel.trim() && <p key={i}>{tel.trim()}</p>)}
            {contacto?.email && <p>{contacto.email}</p>}
            {contacto?.ciudad && <p>{contacto.ciudad}</p>}
          </div>
          {redes.length > 0 && (
            <div className="landing-footer-col">
              <p className="landing-footer-col-title">Seguinos</p>
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
          <span>Panel de gestión interno — no es una tienda con checkout online.</span>
        </div>
      </div>
    </footer>
  );
}
