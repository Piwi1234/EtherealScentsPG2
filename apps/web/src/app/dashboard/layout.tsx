"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getAuthUser, type AuthUser } from "../../lib/auth";
// El sidebar es chrome compartido: siempre lleva el tema "Nocturne" (ver el className condicional
// más abajo para el resto de la página), así que usa el set de íconos de esa skin, no el de
// icons.tsx. El mockup solo muestra ícono en el toggle/nav de primer nivel — los ítems anidados
// (Listado, Pedidos, Cuenta Bs, Atributos, etc.) son texto solo, sin ícono.
import {
  BrandsIcon,
  CategoriesIcon,
  ChevronDownIcon,
  ClientsIcon,
  ContabilidadIcon,
  DashboardIcon,
  LogoutIcon,
  ProductsIcon,
  ProformasIcon,
  SettingsIcon,
  StockIcon,
} from "../../components/nocturne-icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, exact: true },
  { href: "/dashboard/categories", label: "Categorías", icon: CategoriesIcon },
  { href: "/dashboard/brands", label: "Marcas", icon: BrandsIcon },
  { href: "/dashboard/products", label: "Productos", icon: ProductsIcon },
];

// Submenú acordeón de Clientes: lista plana, sin subtítulos de grupo (a diferencia de Configuración).
const CLIENTES_ITEMS = [
  { href: "/dashboard/clientes", label: "Listado" },
  { href: "/dashboard/clientes/pedidos", label: "Pedidos" },
];

// Submenú acordeón de Proveedores: mismo esqueleto que Clientes (Listado/Pedidos). Pedidos queda
// "Próximamente" hasta tener pensada su funcionalidad.
const PROVEEDORES_ITEMS = [
  { href: "/dashboard/proveedores", label: "Listado" },
  { href: "/dashboard/proveedores/pedidos", label: "Pedidos" },
];

// Submenú acordeón de Stock: existencias/lotes de compra separado del historial de traspasos.
const STOCK_ITEMS = [
  { href: "/dashboard/stock", label: "Existencias" },
  { href: "/dashboard/stock/traspasos", label: "Traspasos" },
];

const PROFORMAS_NAV_ITEMS = [
  { href: "/dashboard/proformas", label: "Proformas", icon: ProformasIcon },
  { href: "/dashboard/registros", label: "Registros", icon: ProformasIcon },
  { href: "/dashboard/seguimiento", label: "Seguimiento", icon: ProformasIcon },
];

// Submenú acordeón de Contabilidad: las 5 Cuentas (por moneda) + la gestión central de Tipos.
const CONTABILIDAD_ITEMS = [
  { href: "/dashboard/contabilidad/cuenta-bs", label: "Cuenta Bs" },
  { href: "/dashboard/contabilidad/cuenta-usdt", label: "Cuenta USDT" },
  { href: "/dashboard/contabilidad/cuenta-gs", label: "Cuenta Gs" },
  { href: "/dashboard/contabilidad/cuenta-chile", label: "Cuenta Chile" },
  { href: "/dashboard/contabilidad/cuenta-usa", label: "Cuenta USA" },
  { href: "/dashboard/contabilidad/tipos", label: "Tipos" },
  { href: "/dashboard/contabilidad/cuentas-por-cobrar", label: "Cuentas por Cobrar" },
  { href: "/dashboard/contabilidad/cuentas-por-pagar", label: "Cuentas por Pagar" },
];

// Submenú acordeón dentro de AJUSTES, agrupado por título. "adminOnly" oculta el grupo entero
// para roles que no sean ADMIN (mismo criterio que antes tenía la sección "Usuarios" suelta).
const CONFIGURACION_GROUPS = [
  { title: "Usuarios", adminOnly: true, items: [{ href: "/dashboard/users", label: "Roles y Permisos" }] },
  { title: "Productos", adminOnly: false, items: [{ href: "/dashboard/attributes", label: "Atributos" }] },
  {
    title: "Global",
    adminOnly: false,
    items: [
      { href: "/dashboard/empresas", label: "Empresas" },
      { href: "/dashboard/almacenes", label: "Almacenes" },
      { href: "/dashboard/configuracion/tipo-cambio", label: "Tipo de cambio" },
    ],
  },
  {
    title: "Grid Imágenes",
    adminOnly: false,
    items: [{ href: "/dashboard/configuracion/grid-imagenes", label: "Grid Imágenes" }],
  },
  {
    title: "Carrito Whatsapp",
    adminOnly: false,
    items: [{ href: "/dashboard/configuracion/carrito-whatsapp", label: "Carrito Whatsapp" }],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [configuracionOpen, setConfiguracionOpen] = useState(false);
  const [clientesOpen, setClientesOpen] = useState(false);
  const [proveedoresOpen, setProveedoresOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [contabilidadOpen, setContabilidadOpen] = useState(false);

  useEffect(() => {
    const stored = getAuthUser();
    if (!stored) {
      router.push("/login");
      return;
    }
    setUser(stored);
  }, [router]);

  const configuracionGroups = CONFIGURACION_GROUPS.filter((g) => !g.adminOnly || user?.rol === "ADMIN");
  const configuracionHasActiveChild = configuracionGroups.some((g) => g.items.some((i) => pathname.startsWith(i.href)));

  useEffect(() => {
    if (configuracionHasActiveChild) setConfiguracionOpen(true);
  }, [configuracionHasActiveChild]);

  const clientesHasActiveChild = pathname.startsWith("/dashboard/clientes");
  // "Listado" también cubre /dashboard/clientes/nuevo y /[id], así que el match más específico
  // (Pedidos) gana cuando aplica, en vez de un simple startsWith por ítem.
  const clientesActiveHref = pathname.startsWith("/dashboard/clientes/pedidos")
    ? "/dashboard/clientes/pedidos"
    : clientesHasActiveChild
      ? "/dashboard/clientes"
      : null;

  useEffect(() => {
    if (clientesHasActiveChild) setClientesOpen(true);
  }, [clientesHasActiveChild]);

  const proveedoresHasActiveChild = pathname.startsWith("/dashboard/proveedores");
  // "Listado" también cubre /dashboard/proveedores a secas, así que el match más específico
  // (Pedidos) gana cuando aplica, mismo criterio que Clientes/Pedidos.
  const proveedoresActiveHref = pathname.startsWith("/dashboard/proveedores/pedidos")
    ? "/dashboard/proveedores/pedidos"
    : proveedoresHasActiveChild
      ? "/dashboard/proveedores"
      : null;

  useEffect(() => {
    if (proveedoresHasActiveChild) setProveedoresOpen(true);
  }, [proveedoresHasActiveChild]);

  const stockHasActiveChild = pathname.startsWith("/dashboard/stock");
  // "Existencias" también cubre /dashboard/stock a secas, así que el match más específico
  // (Traspasos) gana cuando aplica, mismo criterio que Clientes/Pedidos.
  const stockActiveHref = pathname.startsWith("/dashboard/stock/traspasos")
    ? "/dashboard/stock/traspasos"
    : stockHasActiveChild
      ? "/dashboard/stock"
      : null;

  useEffect(() => {
    if (stockHasActiveChild) setStockOpen(true);
  }, [stockHasActiveChild]);

  const contabilidadHasActiveChild = pathname.startsWith("/dashboard/contabilidad");

  useEffect(() => {
    if (contabilidadHasActiveChild) setContabilidadOpen(true);
  }, [contabilidadHasActiveChild]);

  function logout() {
    clearSession();
    router.push("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside className="sidebar nocturne-theme">
        <div className="sidebar-brand">Panel</div>
        <div className="sidebar-section-title">Principal</div>
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`sidebar-link sidebar-accordion-toggle${clientesHasActiveChild ? " active" : ""}`}
            onClick={() => setClientesOpen((open) => !open)}
            aria-expanded={clientesOpen}
          >
            <ClientsIcon className="sidebar-link-icon" />
            <span>Clientes</span>
            <ChevronDownIcon className={`sidebar-accordion-chevron${clientesOpen ? " open" : ""}`} />
          </button>
          <div className={`sidebar-accordion-panel${clientesOpen ? " open" : ""}`}>
            <div className="sidebar-accordion-panel-inner">
              {CLIENTES_ITEMS.map((item) => {
                const active = item.href === clientesActiveHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link sidebar-link-nested${active ? " active" : ""}`}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            className={`sidebar-link sidebar-accordion-toggle${proveedoresHasActiveChild ? " active" : ""}`}
            onClick={() => setProveedoresOpen((open) => !open)}
            aria-expanded={proveedoresOpen}
          >
            <ClientsIcon className="sidebar-link-icon" />
            <span>Proveedores</span>
            <ChevronDownIcon className={`sidebar-accordion-chevron${proveedoresOpen ? " open" : ""}`} />
          </button>
          <div className={`sidebar-accordion-panel${proveedoresOpen ? " open" : ""}`}>
            <div className="sidebar-accordion-panel-inner">
              {PROVEEDORES_ITEMS.map((item) => {
                const active = item.href === proveedoresActiveHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link sidebar-link-nested${active ? " active" : ""}`}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`sidebar-link${active ? " active" : ""}`}>
                <Icon className="sidebar-link-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={`sidebar-link sidebar-accordion-toggle${stockHasActiveChild ? " active" : ""}`}
            onClick={() => setStockOpen((open) => !open)}
            aria-expanded={stockOpen}
          >
            <StockIcon className="sidebar-link-icon" />
            <span>Stock</span>
            <ChevronDownIcon className={`sidebar-accordion-chevron${stockOpen ? " open" : ""}`} />
          </button>
          <div className={`sidebar-accordion-panel${stockOpen ? " open" : ""}`}>
            <div className="sidebar-accordion-panel-inner">
              {STOCK_ITEMS.map((item) => {
                const active = item.href === stockActiveHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link sidebar-link-nested${active ? " active" : ""}`}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
        <div className="sidebar-section-title">Proformas</div>
        <nav className="sidebar-nav">
          {PROFORMAS_NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`sidebar-link${active ? " active" : ""}`}>
                <Icon className="sidebar-link-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-section-title">FINANCIERO</div>
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`sidebar-link sidebar-accordion-toggle${contabilidadHasActiveChild ? " active" : ""}`}
            onClick={() => setContabilidadOpen((open) => !open)}
            aria-expanded={contabilidadOpen}
          >
            <ContabilidadIcon className="sidebar-link-icon" />
            <span>Contabilidad</span>
            <ChevronDownIcon className={`sidebar-accordion-chevron${contabilidadOpen ? " open" : ""}`} />
          </button>
          <div className={`sidebar-accordion-panel${contabilidadOpen ? " open" : ""}`}>
            <div className="sidebar-accordion-panel-inner">
              {CONTABILIDAD_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link sidebar-link-nested${active ? " active" : ""}`}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
        <div className="sidebar-section-title">AJUSTES</div>
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`sidebar-link sidebar-accordion-toggle${configuracionHasActiveChild ? " active" : ""}`}
            onClick={() => setConfiguracionOpen((open) => !open)}
            aria-expanded={configuracionOpen}
          >
            <SettingsIcon className="sidebar-link-icon" />
            <span>Configuración</span>
            <ChevronDownIcon className={`sidebar-accordion-chevron${configuracionOpen ? " open" : ""}`} />
          </button>
          <div className={`sidebar-accordion-panel${configuracionOpen ? " open" : ""}`}>
            <div className="sidebar-accordion-panel-inner">
              {configuracionGroups.map((group) => (
                <div key={group.title} className="sidebar-accordion-group">
                  <div className="sidebar-accordion-group-title">{group.title}</div>
                  {group.items.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-link sidebar-link-nested${active ? " active" : ""}`}
                      >
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </nav>
        <button className="sidebar-logout" type="button" onClick={logout}>
          <LogoutIcon className="sidebar-link-icon" />
          <span>Logout</span>
        </button>
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }} className="nocturne-theme">
        <header className="topbar">
          <span>{user ? `${user.nombre} (${user.rol})` : "Cargando..."}</span>
          <Link href="/home" className="button">Catálogo</Link>
        </header>
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
