"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, getCasaMatrizLogo } from "../../lib/api";
import type { Category } from "../../lib/types";

/** Footer de todo el sitio público — trae el ancla #contacto usada por LandingNavbar. */
export function LandingFooter() {
  const [empresa, setEmpresa] = useState<{ nombre: string | null } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    getCasaMatrizLogo().then(setEmpresa).catch(() => {});
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
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
              <Link key={cat.id} href={`/categoria/${cat.id}`}>
                {cat.name}
              </Link>
            ))}
            <Link href="/dashboard">Gestión</Link>
          </div>
          <div className="landing-footer-col">
            <p className="landing-footer-col-title">Contacto</p>
            {/* Datos de ejemplo — reemplazar por los reales. */}
            <p>+591 700 00000</p>
            <p>hola@etherealscents.com</p>
            <p>Cochabamba, Bolivia</p>
          </div>
          <div className="landing-footer-col">
            <p className="landing-footer-col-title">Seguinos</p>
            {/* Enlaces de ejemplo — reemplazar por las redes reales. */}
            <div className="landing-footer-social">
              <a href="#" aria-label="Instagram" onClick={(e) => e.preventDefault()}>IG</a>
              <a href="#" aria-label="Facebook" onClick={(e) => e.preventDefault()}>FB</a>
              <a href="#" aria-label="WhatsApp" onClick={(e) => e.preventDefault()}>WA</a>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} {brandName}. Todos los derechos reservados.</span>
          <span>Panel de gestión interno — no es una tienda con checkout online.</span>
        </div>
      </div>
    </footer>
  );
}
