"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getAuthUser, type AuthUser } from "../../lib/auth";
import {
  AlmacenesIcon,
  AttributesIcon,
  BrandsIcon,
  CategoriesIcon,
  ChevronDownIcon,
  ClientsIcon,
  DashboardIcon,
  EmpresasIcon,
  ListIcon,
  LogoutIcon,
  OrdersIcon,
  ProductsIcon,
  ProformasIcon,
  SeguimientoIcon,
  SettingsIcon,
  StockIcon,
  UsersIcon,
} from "../../components/icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, exact: true },
  { href: "/dashboard/categories", label: "Categorías", icon: CategoriesIcon },
  { href: "/dashboard/brands", label: "Marcas", icon: BrandsIcon },
  { href: "/dashboard/products", label: "Productos", icon: ProductsIcon },
  { href: "/dashboard/stock", label: "Stock", icon: StockIcon },
];

// Submenú acordeón de Clientes: lista plana, sin subtítulos de grupo (a diferencia de Configuración).
const CLIENTES_ITEMS = [
  { href: "/dashboard/clientes", label: "Listado", icon: ListIcon },
  { href: "/dashboard/clientes/pedidos", label: "Pedidos", icon: OrdersIcon },
];

const PROFORMAS_NAV_ITEMS = [
  { href: "/dashboard/proformas", label: "Proformas", icon: ProformasIcon },
  { href: "/dashboard/seguimiento", label: "Seguimiento", icon: SeguimientoIcon },
];

// Submenú acordeón dentro de AJUSTES, agrupado por título. "adminOnly" oculta el grupo entero
// para roles que no sean ADMIN (mismo criterio que antes tenía la sección "Usuarios" suelta).
const CONFIGURACION_GROUPS = [
  { title: "Usuarios", adminOnly: true, items: [{ href: "/dashboard/users", label: "Roles y Permisos", icon: UsersIcon }] },
  { title: "Productos", adminOnly: false, items: [{ href: "/dashboard/attributes", label: "Atributos", icon: AttributesIcon }] },
  {
    title: "Global",
    adminOnly: false,
    items: [
      { href: "/dashboard/empresas", label: "Empresas", icon: EmpresasIcon },
      { href: "/dashboard/almacenes", label: "Almacenes", icon: AlmacenesIcon },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [configuracionOpen, setConfiguracionOpen] = useState(false);
  const [clientesOpen, setClientesOpen] = useState(false);

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

  function logout() {
    clearSession();
    router.push("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside className="sidebar">
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
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link sidebar-link-nested${active ? " active" : ""}`}
                  >
                    <Icon className="sidebar-link-icon" />
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
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-link sidebar-link-nested${active ? " active" : ""}`}
                      >
                        <Icon className="sidebar-link-icon" />
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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header className="topbar">
          <span>{user ? `${user.nombre} (${user.rol})` : "Cargando..."}</span>
          <Link href="/" className="button">Catálogo</Link>
        </header>
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
