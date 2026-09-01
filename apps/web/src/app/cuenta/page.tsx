"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { clearCustomerSession, getCustomerUser, updateCustomerUserName, type CustomerUser } from "../../lib/customer-auth";
import { getMyProfile, logoutCustomer, updateMyProfile } from "../../lib/customer-api";
import { getCiudadesPublicas } from "../../lib/api";

export default function CuentaPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudadId, setCiudadId] = useState("");
  const [ciudades, setCiudades] = useState<{ id: string; nombre: string }[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setCustomer(getCustomerUser());
    getCiudadesPublicas().then(setCiudades).catch(() => {});
    getMyProfile()
      .then((perfil) => {
        setNombre(perfil.nombre);
        setTelefono(perfil.telefono ?? "");
        setDireccion(perfil.direccion ?? "");
        setCiudadId(perfil.ciudadId ?? "");
        setEmail(perfil.email);
      })
      .catch(() => setError("No se pudieron cargar tus datos."))
      .finally(() => setLoadingProfile(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const perfil = await updateMyProfile({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        ciudadId: ciudadId || undefined,
      });
      updateCustomerUserName(perfil.nombre);
      setCustomer((prev) => (prev ? { ...prev, nombre: perfil.nombre } : prev));
      setMessage("Datos actualizados.");
    } catch {
      setError("No se pudieron guardar los cambios, intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    const refreshToken = localStorage.getItem("customer_refresh_token");
    try {
      if (refreshToken) await logoutCustomer(refreshToken);
    } catch {
      // Si el refresh token ya estaba vencido/revocado, igual limpiamos la sesión local abajo.
    }
    clearCustomerSession();
    router.push("/home");
  }

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <section className="landing-section landing-auth-section">
        <div className="landing-auth-card">
          <h1 className="landing-auth-title">Mi cuenta</h1>
          {customer ? (
            <>
              <p className="landing-auth-lead">Hola, {customer.nombre}{email ? ` — ${email}` : ""}</p>

              {!loadingProfile && (
                <>
                  {message && <p className="landing-auth-lead">{message}</p>}
                  {error && <p className="landing-auth-error">{error}</p>}

                  <div className="landing-auth-field">
                    <label htmlFor="cuenta-nombre">Nombre</label>
                    <input id="cuenta-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  </div>
                  <div className="landing-auth-field">
                    <label htmlFor="cuenta-telefono">Teléfono</label>
                    <input id="cuenta-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                  </div>
                  <div className="landing-auth-field">
                    <label htmlFor="cuenta-direccion">Dirección</label>
                    <input id="cuenta-direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                  </div>
                  <div className="landing-auth-field">
                    <label htmlFor="cuenta-ciudad">Ciudad</label>
                    <select id="cuenta-ciudad" value={ciudadId} onChange={(e) => setCiudadId(e.target.value)}>
                      <option value="">Seleccioná una ciudad</option>
                      {ciudades.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="landing-btn landing-btn-primary landing-auth-submit"
                    onClick={handleSave}
                    disabled={saving || !nombre.trim()}
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </>
              )}

              <button
                type="button"
                className="landing-btn landing-btn-outline-dark landing-auth-submit landing-auth-logout"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
              </button>
            </>
          ) : (
            <p className="landing-auth-lead">Cargando...</p>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
