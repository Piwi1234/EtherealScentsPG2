"use client";

import Link from "next/link";
import { useCart, type CartItem } from "../../lib/cart-context";

// Número de WhatsApp al que se envían los pedidos armados desde el carrito (formato internacional,
// sin "+" ni espacios, como lo espera el enlace wa.me).
const WHATSAPP_NUMBER = "59167696116";

function buildWhatsappMessage(items: CartItem[], totalBs: number): string {
  const lines = items.map(
    (item) => `• ${item.name} (${item.code}) x${item.qty} — Bs ${(item.unitPriceBs * item.qty).toFixed(2)}`,
  );
  return `Hola, quiero solicitar una cotización de:\n\n${lines.join("\n")}\n\nTotal: Bs ${totalBs.toFixed(2)}`;
}

export function CartWidget() {
  const { items, isOpen, open, close, removeItem, setQty, totalItems, totalBs } = useCart();

  return (
    <>
      <button type="button" className="landing-cart-fab" aria-label="Ver carrito" onClick={open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1.4" />
          <circle cx="18" cy="21" r="1.4" />
          <path d="M2.5 3h2.4l2.2 12.2a2.2 2.2 0 0 0 2.2 1.8h7.9a2.2 2.2 0 0 0 2.2-1.8L21 7H6.2" />
        </svg>
        {totalItems > 0 && <span className="landing-cart-fab-badge">{totalItems}</span>}
      </button>

      {isOpen && (
        <>
          <div className="landing-cart-overlay" onClick={close} />
          <aside className="landing-cart-drawer" role="dialog" aria-label="Carrito de compras">
            <div className="landing-cart-drawer-header">
              <h2>Carrito</h2>
              <button type="button" className="landing-cart-drawer-close" aria-label="Cerrar carrito" onClick={close}>
                ×
              </button>
            </div>

            <div className="landing-cart-drawer-body">
              {items.length === 0 ? (
                <p className="landing-cart-empty">Tu carrito está vacío.</p>
              ) : (
                items.map((item) => (
                  <div className="landing-cart-item" key={item.key}>
                    {item.imageUrl ? (
                      <img className="landing-cart-item-image" src={item.imageUrl} alt={item.name} />
                    ) : (
                      <div className="landing-cart-item-image landing-cart-item-image-placeholder">{item.name.slice(0, 1)}</div>
                    )}
                    <div className="landing-cart-item-info">
                      <Link href={`/producto/${item.productSlug}`} className="landing-cart-item-name" onClick={close}>
                        {item.name}
                      </Link>
                      <p className="landing-cart-item-code">Código {item.code}</p>
                      <div className="landing-cart-item-row">
                        <div className="landing-cart-item-qty">
                          <button type="button" aria-label="Restar" onClick={() => setQty(item.key, item.qty - 1)}>
                            −
                          </button>
                          <span>{item.qty}</span>
                          <button type="button" aria-label="Sumar" onClick={() => setQty(item.key, item.qty + 1)}>
                            +
                          </button>
                        </div>
                        <p className="landing-cart-item-subtotal">Bs {(item.unitPriceBs * item.qty).toFixed(2)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="landing-cart-item-remove"
                      aria-label="Eliminar del carrito"
                      onClick={() => removeItem(item.key)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="landing-cart-drawer-footer">
                <p className="landing-cart-disclaimer">Los precios del catálogo pueden cambiar sin previo aviso.</p>
                <p className="landing-cart-total">
                  Total: <strong>Bs {totalBs.toFixed(2)}</strong>
                </p>
                <a
                  className="landing-cart-whatsapp-btn"
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsappMessage(items, totalBs))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.13-2.9-7C17.18 3.03 14.7 2 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.18 8.18 0 0 1-1.26-4.34c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.26.86 5.82 2.41a8.17 8.17 0 0 1 2.41 5.82c0 4.53-3.7 8.21-8.2 8.21Zm4.5-6.15c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.24-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.23.24-.86.84-.86 2.05s.88 2.38 1 2.54c.13.16 1.73 2.64 4.2 3.7.59.25 1.05.4 1.4.52.59.19 1.13.16 1.55.1.47-.07 1.46-.6 1.67-1.17.2-.58.2-1.08.14-1.18-.06-.1-.22-.16-.47-.28Z" />
                  </svg>
                  Solicitar cotización por WhatsApp
                </a>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
