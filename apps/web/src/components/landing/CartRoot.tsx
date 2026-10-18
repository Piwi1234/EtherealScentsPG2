"use client";

import { usePathname } from "next/navigation";
import { CartProvider } from "../../lib/cart-context";
import { CartWidget } from "./CartWidget";
import { CookieConsent } from "./CookieConsent";
import { PromoModal } from "./PromoModal";

// El FAB/drawer del carrito y el modal de cookies son solo del sitio público — el panel de gestión
// (/dashboard) no los usa.
export function CartRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard") ?? false;

  return (
    <CartProvider>
      {children}
      {!isDashboard && (
        <>
          <CartWidget />
          <CookieConsent />
          <PromoModal />
        </>
      )}
    </CartProvider>
  );
}
