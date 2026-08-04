"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPut, ApiError } from "../../lib/api";
import { ExchangeIcon } from "../../components/icons";

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
    <div className="card stat-card">
      <div className="stat-card-header">
        <div className="stat-card-icon">
          <ExchangeIcon />
        </div>
        <h2 className="section-label" style={{ margin: 0 }}>Tipo de cambio</h2>
      </div>

      {loading ? (
        <p style={{ margin: 0 }}>Cargando...</p>
      ) : (
        <>
          <div className="stat-value">
            {savedRate !== null ? savedRate : "—"}
            <span className="unit">Bs por $1</span>
          </div>

          <form onSubmit={handleSave} className="stat-card-form">
            <div className="field-group">
              <label>Nuevo valor</label>
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
            <button type="submit" className="button" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </form>

          {success && <p className="stat-feedback">✓ Tipo de cambio actualizado correctamente.</p>}
          {error && <p className="error-text">{error}</p>}
        </>
      )}
    </div>
  );
}
