"use client";

import { usePathname } from "next/navigation";
import { CartProvider } from "../../lib/cart-context";
import { CartWidget } from "./CartWidget";

// El FAB/drawer del carrito es solo del sitio público — el panel de gestión (/dashboard) no lo usa.
export function CartRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard") ?? false;

  return (
    <CartProvider>
      {children}
      {!isDashboard && <CartWidget />}
    </CartProvider>
  );
}
