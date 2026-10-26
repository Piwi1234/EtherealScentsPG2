"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { AuthUser } from "../../lib/auth";
import { getCasaMatrizLogo } from "../../lib/api";
import { productImageSrc } from "../../lib/catalog-display";
import { ChevronDownIcon, DashboardIcon, LogoutIcon } from "../nocturne-icons";

type NavItem = {
  href: string;
  label: string;
  /** Una línea que explica para qué sirve la pantalla (se muestra en el desplegable). */
  desc?: string;
  /** Solo para los dos listados de proformas, que comparten ruta y se distinguen por ?tipo=. */
  tipo?: "VENTA" | "COMPRA";
};
type NavGroup = { id: string; label: string; sections: { title?: string; adminOnly?: boolean; items: NavItem[] }[] };

const GROUPS: NavGroup[] = [
  {
    id: "ventas",
    label: "Ventas",
    sections: [
      {
        items: [
          { href: "/dashboard/proformas?tipo=VENTA", tipo: "VENTA", label: "Proformas de venta", desc: "Crea, aprueba y completa notas de venta" },
          { href: "/dashboard/seguimiento", label: "Seguimiento", desc: "Qué falta comprar para los pedidos de clientes" },
          { href: "/dashboard/clientes/pedidos", label: "Pedidos de clientes", desc: "Pedidos que llegan desde el catálogo" },
        ],
      },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    sections: [
      {
        items: [
          { href: "/dashboard/proformas?tipo=COMPRA", tipo: "COMPRA", label: "Proformas de compra", desc: "Crea y aprueba pedidos a proveedores" },
          { href: "/dashboard/stock/envios", label: "Envíos", desc: "Agrupa compras y recibe la mercadería" },
          { href: "/dashboard/proveedores/pedidos", label: "Pedidos a proveedores", desc: "Seguimiento de lo pedido a cada proveedor" },
        ],
      },
    ],
  },
  {
    id: "inventario",
    label: "Inventario",
    sections: [
      {
        items: [
          { href: "/dashboard/products", label: "Productos", desc: "Catálogo, variantes y precios" },
          { href: "/dashboard/stock", label: "Existencias", desc: "Stock físico, reservado y en tránsito por almacén" },
          { href: "/dashboard/stock/traspasos", label: "Traspasos", desc: "Mover mercadería entre almacenes" },
          { href: "/dashboard/categories", label: "Categorías", desc: "Organización del catálogo" },
          { href: "/dashboard/brands", label: "Marcas", desc: "Marcas de los productos" },
        ],
      },
    ],
  },
  {
    id: "personas",
    label: "Personas",
    sections: [
      {
        items: [
          { href: "/dashboard/clientes", label: "Clientes", desc: "Fichas, compras y pagos" },
          { href: "/dashboard/proveedores", label: "Proveedores", desc: "Contactos y condiciones" },
        ],
      },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    sections: [
      {
        items: [
          { href: "/dashboard/contabilidad/cuentas-por-cobrar", label: "Cuentas por cobrar", desc: "Saldos pendientes de clientes" },
          { href: "/dashboard/contabilidad/cuentas-por-pagar", label: "Cuentas por pagar", desc: "Saldos pendientes con proveedores" },
          { href: "/dashboard/contabilidad/cuenta-bs", label: "Cuenta Bs" },
          { href: "/dashboard/contabilidad/cuenta-usdt", label: "Cuenta USDT" },
          { href: "/dashboard/contabilidad/cuenta-gs", label: "Cuenta Gs" },
          { href: "/dashboard/contabilidad/cuenta-chile", label: "Cuenta Chile" },
          { href: "/dashboard/contabilidad/cuenta-usa", label: "Cuenta USA" },
          { href: "/dashboard/contabilidad/tipos", label: "Tipos", desc: "Tipos de ingreso y egreso" },
        ],
      },
    ],
  },
  {
    id: "ajustes",
    label: "Ajustes",
    sections: [
      { title: "Usuarios", adminOnly: true, items: [{ href: "/dashboard/users", label: "Roles y permisos" }] },
      { title: "Productos", items: [{ href: "/dashboard/attributes", label: "Atributos" }] },
      {
        title: "Global",
        items: [
          { href: "/dashboard/empresas", label: "Empresas" },
          { href: "/dashboard/almacenes", label: "Almacenes", desc: "Incluye el almacén por defecto" },
          { href: "/dashboard/configuracion/tipo-cambio", label: "Tipo de cambio" },
          { href: "/dashboard/configuracion/contacto", label: "Contacto" },
        ],
      },
      {
        title: "Sitio público",
        items: [
          { href: "/dashboard/historias", label: "Historias", desc: "Contenido del sitio público" },
          { href: "/dashboard/configuracion/grid-imagenes", label: "Grid de imágenes" },
          { href: "/dashboard/configuracion/carrito-whatsapp", label: "Carrito WhatsApp" },
        ],
      },
    ],
  },
];

const ULTIMA_LISTA_KEY = "proformas:ultima-lista";

function pathOf(href: string): string {
  return href.split("?")[0];
}

/**
 * Barra de navegación superior del panel: Inicio + menús desplegables por área de trabajo, acceso al
 * catálogo y sesión. En pantallas angostas el menú pasa a un drawer lateral (mismo patrón que el
 * menú móvil del sitio público: fondo que se oscurece y panel que entra desde la izquierda) con un
 * acordeón por área de trabajo.
 */
export function GlobalNav({ user, onLogout }: { user: AuthUser | null; onLogout: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileGroups, setOpenMobileGroups] = useState<Set<string>>(new Set());
  const [tipoGuardado, setTipoGuardado] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState<{ nombre: string | null; logoUrl: string | null } | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Logo (y nombre) de la casa matriz, el mismo que usa el sitio público.
  useEffect(() => {
    getCasaMatrizLogo().then(setEmpresa).catch(() => {});
  }, []);
  const logoSrc = productImageSrc(empresa?.logoUrl ?? null);

  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        sections: g.sections.filter((s) => !s.adminOnly || user?.rol === "ADMIN"),
      })),
    [user?.rol],
  );

  // En el detalle de una proforma la URL no dice si es de venta o de compra: se infiere de la última
  // lista que se visitó (la guarda ProformaFiltros).
  useEffect(() => {
    if (!pathname.startsWith("/dashboard/proformas/")) return;
    try {
      const guardada = sessionStorage.getItem(ULTIMA_LISTA_KEY);
      setTipoGuardado(guardada ? new URL(guardada, "http://x").searchParams.get("tipo") : null);
    } catch {
      setTipoGuardado(null);
    }
  }, [pathname]);

  const tipoActual = pathname === "/dashboard/proformas" ? searchParams.get("tipo") : tipoGuardado;

  // El ítem activo es el de ruta más larga que coincide con la actual (así /clientes/pedidos gana
  // sobre /clientes, y /stock/envios sobre /stock).
  const activo = useMemo(() => {
    let best: { groupId: string; href: string; len: number } | null = null;
    for (const g of groups) {
      for (const s of g.sections) {
        for (const item of s.items) {
          const p = pathOf(item.href);
          const coincide = pathname === p || pathname.startsWith(`${p}/`);
          if (!coincide) continue;
          if (item.tipo && item.tipo !== tipoActual) continue;
          if (!best || p.length > best.len) best = { groupId: g.id, href: item.href, len: p.length };
        }
      }
    }
    return best;
  }, [groups, pathname, tipoActual]);

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname, searchParams]);

  // Al abrir el drawer móvil se despliega el área donde estás y se bloquea el scroll de la página.
  useEffect(() => {
    if (!mobileOpen) return;
    setOpenMobileGroups(new Set(activo ? [activo.groupId] : []));
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileOpen]);

  function toggleMobileGroup(id: string) {
    setOpenMobileGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const marca = logoSrc ? (
    <img className="gnav-brand-logo" src={logoSrc} alt={empresa?.nombre ?? "Panel"} />
  ) : (
    <>
      <span className="gnav-logo">{(empresa?.nombre ?? "P").slice(0, 1).toUpperCase()}</span>
      <span>{empresa?.nombre ?? "Panel"}</span>
    </>
  );

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
    <header className="gnav nocturne-theme" ref={navRef}>
      <Link href="/dashboard" className="gnav-brand">
        {marca}
      </Link>

      <button
        type="button"
        className="gnav-burger"
        aria-expanded={mobileOpen}
        aria-label="Abrir menú"
        onClick={() => setMobileOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className="gnav-menu">
        <Link href="/dashboard" className={`gnav-link${pathname === "/dashboard" ? " active" : ""}`}>
          <DashboardIcon className="gnav-icon" />
          <span>Inicio</span>
        </Link>

        <Link
          href="/dashboard/registros"
          className={`gnav-link${pathname === "/dashboard/registros" || pathname.startsWith("/dashboard/registros/") ? " active" : ""}`}
        >
          <span>Registros</span>
        </Link>

        {groups.map((g) => {
          const abierto = openGroup === g.id;
          const grupoActivo = activo?.groupId === g.id;
          return (
            <div key={g.id} className="gnav-group">
              <button
                type="button"
                className={`gnav-link gnav-toggle${grupoActivo ? " active" : ""}${abierto ? " open" : ""}`}
                aria-expanded={abierto}
                onClick={() => setOpenGroup((cur) => (cur === g.id ? null : g.id))}
              >
                <span>{g.label}</span>
                <ChevronDownIcon className="gnav-chevron" />
              </button>
              <div className={`gnav-drop${abierto ? " open" : ""}`}>
                {g.sections.map((s, i) => (
                  <div key={s.title ?? i} className="gnav-section">
                    {s.title && <div className="gnav-section-title">{s.title}</div>}
                    {s.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`gnav-item${activo?.href === item.href ? " active" : ""}`}
                      >
                        <b>{item.label}</b>
                        {item.desc && <span>{item.desc}</span>}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="gnav-right">
        <Link href="/home" className="gnav-catalogo">
          Catálogo
        </Link>
        <span className="gnav-user" title={user ? `${user.nombre} (${user.rol})` : undefined}>
          <span className="gnav-avatar">{user ? user.nombre.slice(0, 2).toUpperCase() : "…"}</span>
          <span className="gnav-user-name">{user ? user.nombre : "Cargando..."}</span>
        </span>
        <button type="button" className="gnav-logout" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogoutIcon className="gnav-icon" />
        </button>
      </div>
    </header>

    {mobileOpen && (
      <div className="nocturne-theme gnav-drawer-root">
        <div className="gnav-m-overlay" onClick={() => setMobileOpen(false)} />
        <nav className="gnav-m" aria-label="Menú del panel">
          <div className="gnav-m-header">
            <Link href="/dashboard" className="gnav-brand">
              {marca}
            </Link>
            <button type="button" className="gnav-m-close" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div className="gnav-m-body">
            <Link href="/dashboard" className={`gnav-m-link${pathname === "/dashboard" ? " active" : ""}`}>
              Inicio
            </Link>
            <Link
              href="/dashboard/registros"
              className={`gnav-m-link${pathname === "/dashboard/registros" || pathname.startsWith("/dashboard/registros/") ? " active" : ""}`}
            >
              Registros
            </Link>

            {groups.map((g) => {
              const expandido = openMobileGroups.has(g.id);
              const grupoActivo = activo?.groupId === g.id;
              return (
                <div key={g.id} className="gnav-m-group">
                  <button
                    type="button"
                    className={`gnav-m-link gnav-m-toggle${grupoActivo ? " active" : ""}`}
                    aria-expanded={expandido}
                    onClick={() => toggleMobileGroup(g.id)}
                  >
                    <span>{g.label}</span>
                    <ChevronDownIcon className={`gnav-m-chevron${expandido ? " open" : ""}`} />
                  </button>
                  {expandido && (
                    <div className="gnav-m-sub">
                      {g.sections.map((s, i) => (
                        <div key={s.title ?? i}>
                          {s.title && <p className="gnav-m-sub-title">{s.title}</p>}
                          {s.items.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`gnav-m-sublink${activo?.href === item.href ? " active" : ""}`}
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="gnav-m-divider" />

            <Link href="/home" className="gnav-m-secondary">
              Ir al catálogo
            </Link>
            <div className="gnav-m-user">
              <span className="gnav-avatar">{user ? user.nombre.slice(0, 2).toUpperCase() : "…"}</span>
              <span className="gnav-m-user-text">
                <b>{user ? user.nombre : "Cargando..."}</b>
                {user && <small>{user.rol}</small>}
              </span>
            </div>
            <button type="button" className="gnav-m-logout" onClick={onLogout}>
              <LogoutIcon className="gnav-icon" />
              Cerrar sesión
            </button>
          </div>
        </nav>
      </div>
    )}
    </>
  );
}
