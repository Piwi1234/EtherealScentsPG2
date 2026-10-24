"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getAuthUser, type AuthUser } from "../../lib/auth";
import { GlobalNav } from "../../components/dashboard/GlobalNav";

/**
 * Chrome del panel: barra de navegación superior (menús por área de trabajo) y el contenido a ancho
 * completo. La verificación de sesión vive acá: sin usuario guardado se manda a /login.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
    <div className="nocturne-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* useSearchParams (para marcar el menú activo) exige un límite de Suspense. */}
      <Suspense fallback={<header className="gnav nocturne-theme" />}>
        <GlobalNav user={user} onLogout={logout} />
      </Suspense>
      <main className="dashboard-main dashboard-main--top">{children}</main>
    </div>
  );
}
