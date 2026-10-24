"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AuthUser } from "../../lib/auth";
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
          { href: "/dashboard/registros", label: "Registros", desc: "Qué se vendió y compró, producto por producto" },
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
          { href: "/dashboard/stock", label: "Existencias", desc: "Stock físico, reservado y en tránsito por almacén" },
          { href: "/dashboard/stock/traspasos", label: "Traspasos", desc: "Mover mercadería entre almacenes" },
          { href: "/dashboard/products", label: "Productos", desc: "Catálogo, variantes y precios" },
          { href: "/dashboard/categories", label: "Categorías", desc: "Organización del catálogo" },
          { href: "/dashboard/brands", label: "Marcas", desc: "Marcas de los productos" },
          { href: "/dashboard/historias", label: "Historias", desc: "Contenido del sitio público" },
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
 * Barra de navegación superior del panel: Inicio + menús desplegables por área de trabajo, buscador
 * de proformas por código (Ctrl+K), acceso al catálogo y sesión. En pantallas angostas se pliega
 * detrás de un botón y los desplegables se muestran abiertos dentro del panel.
 */
export function GlobalNav({ user, onLogout }: { user: AuthUser | null; onLogout: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [tipoGuardado, setTipoGuardado] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = codigo.trim();
    if (!q) return;
    router.push(`/dashboard/proformas?codigo=${encodeURIComponent(q)}`);
    setCodigo("");
    searchRef.current?.blur();
  }

  return (
    <header className="gnav nocturne-theme" ref={navRef}>
      <Link href="/dashboard" className="gnav-brand">
        <span className="gnav-logo">P</span>
        <span>Panel</span>
      </Link>

      <button
        type="button"
        className="gnav-burger"
        aria-expanded={mobileOpen}
        aria-label="Menú"
        onClick={() => setMobileOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`gnav-menu${mobileOpen ? " open" : ""}`}>
        <Link href="/dashboard" className={`gnav-link${pathname === "/dashboard" ? " active" : ""}`}>
          <DashboardIcon className="gnav-icon" />
          <span>Inicio</span>
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
        <form className="gnav-search" onSubmit={buscar} role="search">
          <input
            ref={searchRef}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código de proforma…"
            aria-label="Buscar proforma por código"
          />
          <kbd>Ctrl K</kbd>
        </form>
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
  );
}
