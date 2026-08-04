"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiGet } from "../../lib/api";
import { clearSession, getAuthUser, type AuthUser } from "../../lib/auth";
import { AttributesIcon, BrandsIcon, CategoriesIcon, DashboardIcon, LogoutIcon, ProductsIcon } from "../../components/icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, exact: true },
  { href: "/dashboard/categories", label: "Categorías", icon: CategoriesIcon },
  { href: "/dashboard/brands", label: "Marcas", icon: BrandsIcon },
  { href: "/dashboard/attributes", label: "Atributos", icon: AttributesIcon },
  { href: "/dashboard/products", label: "Productos", icon: ProductsIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getAuthUser());
    apiGet<AuthUser>("/auth/me").then(setUser).catch(() => router.push("/login"));
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
        <button className="sidebar-logout" type="button" onClick={logout}>
          <LogoutIcon className="sidebar-link-icon" />
          <span>Logout</span>
        </button>
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header className="topbar">
          <span>{user ? `${user.name} (${user.role})` : "Cargando..."}</span>
          <Link href="/" className="button">Catálogo</Link>
        </header>
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
