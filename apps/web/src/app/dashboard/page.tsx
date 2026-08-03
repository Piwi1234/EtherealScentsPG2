"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../../lib/api";
import { clearSession, getAuthUser, type AuthUser } from "../../lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const cached = getAuthUser();
    setUser(cached);
    apiGet<AuthUser>("/auth/me").then(setUser).catch(() => router.push("/login"));
  }, [router]);

  function logout() {
    clearSession();
    router.push("/login");
  }

  return (
    <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 20px" }}>
      <div className="card">
        <h1 style={{ marginTop: 0, fontSize: 20 }}>Panel</h1>
        {user ? (
          <p>
            Hola, <strong>{user.name}</strong> ({user.role}) — sesión funcionando correctamente.
          </p>
        ) : (
          <p>Cargando...</p>
        )}
        <button className="button" type="button" onClick={logout}>Cerrar sesión</button>
      </div>
    </div>
  );
}
