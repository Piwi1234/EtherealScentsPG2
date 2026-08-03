"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiGet } from "../../lib/api";
import { clearSession, getAuthUser, type AuthUser } from "../../lib/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Resumen", exact: true },
  { href: "/dashboard/categories", label: "Categorías" },
  { href: "/dashboard/brands", label: "Marcas" },
  { href: "/dashboard/attributes", label: "Atributos" },
  { href: "/dashboard/products", label: "Productos" },
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
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`sidebar-link${active ? " active" : ""}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header className="topbar">
          <span>{user ? `${user.name} (${user.role})` : "Cargando..."}</span>
          <button className="button" type="button" onClick={logout}>Cerrar sesión</button>
        </header>
        <main style={{ padding: 24, flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}
