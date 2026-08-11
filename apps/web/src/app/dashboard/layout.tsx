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
  ClientsIcon,
  DashboardIcon,
  EmpresasIcon,
  LogoutIcon,
  ProductsIcon,
  ProformasIcon,
  SeguimientoIcon,
  StockIcon,
  UsersIcon,
} from "../../components/icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, exact: true },
  { href: "/dashboard/clientes", label: "Clientes", icon: ClientsIcon },
  { href: "/dashboard/categories", label: "Categorías", icon: CategoriesIcon },
  { href: "/dashboard/brands", label: "Marcas", icon: BrandsIcon },
  { href: "/dashboard/attributes", label: "Atributos", icon: AttributesIcon },
  { href: "/dashboard/products", label: "Productos", icon: ProductsIcon },
];

const PROFORMAS_NAV_ITEMS = [
  { href: "/dashboard/proformas", label: "Proformas", icon: ProformasIcon },
  { href: "/dashboard/seguimiento", label: "Seguimiento", icon: SeguimientoIcon },
  { href: "/dashboard/empresas", label: "Empresas", icon: EmpresasIcon },
  { href: "/dashboard/almacenes", label: "Almacenes", icon: AlmacenesIcon },
  { href: "/dashboard/stock", label: "Stock", icon: StockIcon },
];

// Sección visible solo para ADMIN.
const ADMIN_NAV_ITEMS = [{ href: "/dashboard/users", label: "Roles y permisos", icon: UsersIcon }];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const stored = getAuthUser();
    if (!stored) {
      router.push("/login");
      return;
    }
    setUser(stored);
  }, [router]);

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
        {user?.rol === "ADMIN" && (
          <>
            <div className="sidebar-section-title">Usuarios</div>
            <nav className="sidebar-nav">
              {ADMIN_NAV_ITEMS.map((item) => {
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
          </>
        )}
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
