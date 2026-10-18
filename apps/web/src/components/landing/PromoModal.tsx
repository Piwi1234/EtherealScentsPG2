"use client";

import { useEffect, useState } from "react";
import { getPromoModal } from "../../lib/api";
import { productImageSrc } from "../../lib/catalog-display";
import { hasSeenPromoModal, markPromoModalSeen } from "../../lib/promo-modal";

// Delay antes de mostrarse (ver la conversación sobre "poco disruptivo") — ni instantáneo (se siente
// como una emboscada apenas carga la página) ni tan tarde que el usuario ya se fue.
const SHOW_DELAY_MS = 2500;

/**
 * Modal promocional del sitio público (Configuración → Grid Imágenes → Modal promocional) — una
 * imagen centrada sobre el sitio, con link opcional. No bloquea la navegación de fondo (el usuario
 * puede seguir scrolleando detrás si la cierra) y se cierra con click afuera, la "×" o Esc. Se
 * muestra una sola vez por imagen (ver lib/promo-modal.ts, localStorage) — si Gestión sube una
 * imagen nueva, vuelve a aparecer sola.
 */
export function PromoModal() {
  const [promo, setPromo] = useState<{ imageUrl: string; url: string | null } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    getPromoModal()
      .then((data) => {
        if (!data.enabled || !data.imageUrl) return;
        if (hasSeenPromoModal(data.imageUrl)) return;
        setPromo({ imageUrl: data.imageUrl, url: data.url });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!promo) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [promo]);

  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function close() {
    if (promo) markPromoModalSeen(promo.imageUrl);
    setVisible(false);
  }

  if (!visible || !promo) return null;

  const src = productImageSrc(promo.imageUrl)!;
  const img = <img className="landing-promo-modal-img" src={src} alt="" />;

  return (
    <div className="landing-promo-modal-overlay" onClick={close}>
      <div className="landing-promo-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="landing-promo-modal-close" aria-label="Cerrar" onClick={close}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
        {promo.url ? (
          <a href={promo.url} target="_blank" rel="noopener noreferrer">
            {img}
          </a>
        ) : (
          img
        )}
      </div>
    </div>
  );
}
