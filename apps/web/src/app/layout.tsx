import type { Metadata } from "next";
import { Inter, Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";
import { CartRoot } from "../components/landing/CartRoot";
import { API_ORIGIN, getCasaMatrizLogo } from "../lib/api";

// Inter: tipografía del Dashboard interno (.nocturne-theme) — declarada por nombre en globals.css
// pero nunca cargada de verdad hasta ahora (sin esto, el navegador caía al fallback system-ui).
//
// Manrope: tipografía del sitio público (.landing-page), texto y títulos por igual — misma familia
// para todo, como Clarkson (la tipografía propia de squarespace.com, no reutilizable por licencia:
// autoalojada en su CDN y exclusiva de Squarespace). Manrope es la alternativa libre (Google Fonts)
// con la estética más parecida: sans geométrica minimalista, con un peso liviano (300) para títulos
// grandes tipo display, igual que el .text--display de Clarkson.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-manrope" });
// Serif itálica elegante — solo para el título de "Encuentra tu aroma ideal" (ScentFinder, home),
// a pedido puntual de ese título nomás. El resto del sitio sigue con Manrope (ver más arriba).
const playfairDisplay = Playfair_Display({ subsets: ["latin"], weight: ["600"], style: ["italic"], variable: "--font-playfair-display" });

export const SITE_TITLE = "Ethereal Scents";
const SITE_DESCRIPTION = "Catálogo online";
export const SITE_ORIGIN = "https://www.etherealscents-bo.com";

export async function generateMetadata(): Promise<Metadata> {
  // Logo de la casa matriz (Gestión → Empresas) — se usa como ícono de pestaña nomás. El logo real es
  // texto blanco pensado para ir sobre el navy del navbar; como og:image quedaba invisible (WhatsApp
  // compone los PNG transparentes sobre blanco) y además con una proporción (1000x280) bien distinta
  // a la que recortan los lectores de Open Graph (~1.91:1) — ver og-default.png, generado aparte con
  // fondo navy sólido en 1200x630 para esto.
  let logoUrl: string | null = null;
  try {
    const empresa = await getCasaMatrizLogo();
    logoUrl = empresa.logoUrl;
  } catch {
    logoUrl = null;
  }

  // Logos subidos antes de la migración a R2 tienen logoUrl relativo ("/uploads/..."); los nuevos
  // ya vienen con la URL pública completa.
  const absoluteLogoUrl = logoUrl ? (logoUrl.startsWith("http") ? logoUrl : `${API_ORIGIN}${logoUrl}`) : null;
  const ogImageUrl = `${SITE_ORIGIN}/og-default.png`;

  return {
    metadataBase: new URL(SITE_ORIGIN),
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    icons: absoluteLogoUrl ? { icon: absoluteLogoUrl } : undefined,
    openGraph: {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      siteName: SITE_TITLE,
      locale: "es",
      type: "website",
      url: SITE_ORIGIN,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [ogImageUrl],
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${manrope.variable} ${playfairDisplay.variable}`}>
      <body>
        <CartRoot>{children}</CartRoot>
      </body>
    </html>
  );
}
