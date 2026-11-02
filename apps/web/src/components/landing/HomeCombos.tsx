"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPublicCombos } from "../../lib/api";
import type { Combo } from "../../lib/types";
import { ComboCard } from "./ComboCard";

const MAX_EN_HOME = 4;

/** Bloque "Combos" del home: los primeros combos publicados. Si no hay ninguno, no se muestra nada. */
export function HomeCombos() {
  const [combos, setCombos] = useState<Combo[]>([]);

  useEffect(() => {
    getPublicCombos()
      .then(setCombos)
      .catch(() => setCombos([]));
  }, []);

  if (combos.length === 0) return null;

  return (
    <section className="landing-section">
      <div className="landing-container">
        <p className="landing-eyebrow">Ahorra más</p>
        <h2 className="landing-section-title">Combos</h2>
        <p className="landing-section-lead">Lleva varios productos juntos con un descuento sobre la suma de sus precios.</p>
        <div className="landing-product-grid">
          {combos.slice(0, MAX_EN_HOME).map((combo) => (
            <ComboCard key={combo.id} combo={combo} />
          ))}
        </div>
        {combos.length > MAX_EN_HOME && (
          <div className="landing-weekly-collection-more">
            <Link href="/combos" className="landing-btn landing-btn-outline-dark">
              Ver todos los combos
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
