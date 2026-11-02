"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError, getCombo } from "../../../../lib/api";
import type { Combo } from "../../../../lib/types";
import { ComboForm } from "../ComboForm";

export default function EditarComboPage() {
  const { id } = useParams<{ id: string }>();
  const [combo, setCombo] = useState<Combo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getCombo(id)
      .then(setCombo)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)));
  }, [id]);

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
      </div>
    );
  }
  if (!combo) return <div className="card"><p className="cell-muted">Cargando...</p></div>;
  return <ComboForm combo={combo} />;
}
