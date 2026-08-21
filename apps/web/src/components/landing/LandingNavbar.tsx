"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, getCasaMatrizLogo } from "../../lib/api";
import { productImageSrc } from "../../lib/catalog-display";
import type { Category } from "../../lib/types";

/**
 * Navbar de todo el sitio público (home + páginas de categoría): transparente
 * sobre el contenido al cargar, sólido al pasar ~80px de scroll. "Nosotros" y
 * "Contacto" intentan hacer scroll a una sección con ese id en la página
 * actual (el footer trae #contacto en todas partes); si no existe, navegan a
 * /home con el hash correspondiente.
 *
 * variant="dark": fondo negro fijo (no transparente, no cambia con el scroll) — para páginas sin
 * hero de fondo oscuro debajo, como el detalle de producto.
 */
export function LandingNavbar({ variant = "default" }: { variant?: "default" | "dark" }) {
  const [empresa, setEmpresa] = useState<{ nombre: string | null; logoUrl: string | null } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  const rootCategories = categories.filter((cat) => cat.parentId === null);
  const categoryTree = rootCategories.map((cat) => ({
    ...cat,
    children: categories.filter((c) => c.parentId === cat.id),
  }));

  useEffect(() => {
    getCasaMatrizLogo().then(setEmpresa).catch(() => {});
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 80);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function goToSection(id: string) {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push(`/home#${id}`);
    }
  }

  const logoSrc = productImageSrc(empresa?.logoUrl ?? null);
  const brandName = empresa?.nombre ?? "Ethereal Scents";
  const navbarClass = [
    "landing-navbar",
    variant === "default" && scrolled ? "landing-navbar--scrolled" : "",
    variant === "dark" ? "landing-navbar--dark" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={navbarClass}>
      <div className="landing-container landing-navbar-inner">
        <Link href="/home" className="landing-navbar-brand" onClick={() => setMobileMenuOpen(false)}>
          {logoSrc ? <img className="landing-navbar-logo" src={logoSrc} alt={brandName} /> : brandName}
        </Link>
        <nav className="landing-navbar-links">
          <div className="landing-navbar-item">
            <a href="#catalogo" onClick={(e) => { e.preventDefault(); goToSection("catalogo"); }}>
              Categorías
            </a>
            <div className="landing-navbar-dropdown">
              {categoryTree.map((cat) => (
                <div className="landing-navbar-dropdown-group" key={cat.id}>
                  <Link
                    className="landing-navbar-dropdown-heading"
                    href={`/categoria/${cat.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {cat.name}
                  </Link>
                  {cat.children.map((sub) => (
                    <Link key={sub.id} href={`/categoria/${sub.id}`} onClick={() => setMobileMenuOpen(false)}>
                      {sub.name}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <a href="#nosotros" onClick={(e) => { e.preventDefault(); goToSection("nosotros"); }}>Nosotros</a>
          <a href="#contacto" onClick={(e) => { e.preventDefault(); goToSection("contacto"); }}>Contacto</a>
        </nav>
        <div className="landing-navbar-actions">
          <Link href="/dashboard" className="landing-navbar-manage">Gestión</Link>
          <button type="button" className="landing-btn landing-btn-primary" onClick={() => goToSection("catalogo")}>
            Ver catálogo
          </button>
          <button
            type="button"
            className={`landing-navbar-toggle${mobileMenuOpen ? " landing-navbar-toggle--open" : ""}`}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="landing-navbar-mobile">
          {categoryTree.map((cat) => (
            <div className="landing-navbar-mobile-group" key={cat.id}>
              <Link
                className="landing-navbar-mobile-heading"
                href={`/categoria/${cat.id}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {cat.name}
              </Link>
              {cat.children.map((sub) => (
                <Link
                  key={sub.id}
                  className="landing-navbar-mobile-sub"
                  href={`/categoria/${sub.id}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          ))}
          <a href="#nosotros" onClick={(e) => { e.preventDefault(); goToSection("nosotros"); }}>Nosotros</a>
          <a href="#contacto" onClick={(e) => { e.preventDefault(); goToSection("contacto"); }}>Contacto</a>
          <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>Gestión</Link>
          <button
            type="button"
            className="landing-btn landing-btn-primary landing-navbar-mobile-cta"
            onClick={() => goToSection("catalogo")}
          >
            Ver catálogo
          </button>
        </nav>
      )}
    </header>
  );
}
