import type { Metadata } from "next";
import { Inter, Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";
import { CartRoot } from "../components/landing/CartRoot";

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
// Serif elegante — título de "Encuentra tu aroma ideal" (ScentFinder, home) y toda la tipografía de
// "Historias" (título/nombre/epígrafe, estilo revista). El resto del sitio sigue con Manrope (ver
// más arriba). Antes solo se cargaba el corte itálico 600 (pensado nomás para ScentFinder) — como
// una familia con un solo corte se usa para CUALQUIER peso/estilo que se le pida (el navegador no
// tiene otra opción), el título de Historia (normal, no itálico) terminaba mostrándose inclinado
// igual; con los 4 cortes de abajo cada uso cae en el corte que realmente le corresponde.
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair-display",
});

export const SITE_TITLE = "Ethereal Scents";
const SITE_DESCRIPTION = "Catálogo online";
export const SITE_ORIGIN = "https://www.etherealscents-bo.com";

export async function generateMetadata(): Promise<Metadata> {
  // Ícono de pestaña y vista previa al compartir el enlace (WhatsApp, redes): el logo "E" sobre el navy del sitio. Los
  // íconos salen de los archivos app/icon.png, app/apple-icon.png y app/favicon.ico; la imagen de vista previa es
  // og-default.png (1200x630, fondo navy sólido: los PNG transparentes se componen sobre blanco y el logo se perdería).
  const ogImageUrl = `${SITE_ORIGIN}/og-default.png`;

  return {
    metadataBase: new URL(SITE_ORIGIN),
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
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
