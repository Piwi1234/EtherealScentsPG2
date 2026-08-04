"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPut, ApiError } from "../../lib/api";

export default function DashboardPage() {
  const [rate, setRate] = useState("");
  const [savedRate, setSavedRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiGet<{ exchangeRate: number }>("/settings/exchange-rate")
      .then((data) => {
        setSavedRate(data.exchangeRate);
        setRate(String(data.exchangeRate));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const data = await apiPut<{ exchangeRate: number }>("/settings/exchange-rate", { exchangeRate: Number(rate) });
      setSavedRate(data.exchangeRate);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ maxWidth: 420 }}>
        <h2 className="section-label">Tipo de cambio</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)" }}>
          Define el tipo de cambio $ → Bs del sistema. Se usa para calcular el Precio May Bs de todos los
          productos (Precio $ × tipo de cambio).
        </p>
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <form onSubmit={handleSave}>
            <div className="grid-2">
              <div>
                <label>Bs por $1</label>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="submit" className="button" disabled={saving} style={{ width: "100%", justifyContent: "center" }}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
            {savedRate !== null && (
              <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)" }}>
                Actual: 1 $ = {savedRate} Bs
              </p>
            )}
            {success && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#2e7d32" }}>Tipo de cambio actualizado correctamente.</p>
            )}
            {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}
          </form>
        )}
      </div>

      <div className="card">
        <h1 style={{ marginTop: 0, fontSize: 20 }}>Resumen</h1>
        <p>Elegí una sección del menú para administrar el catálogo: categorías, marcas, atributos o productos.</p>
      </div>
    </div>
  );
}
