import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
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

const SITE_TITLE = "Ethereal Scents";
const SITE_DESCRIPTION = "Perfumes y vapes originales — catálogo, ofertas y cotización directa.";

export async function generateMetadata(): Promise<Metadata> {
  // Logo de la casa matriz (Gestión → Empresas) como og:image — si la API no responde (build sin
  // backend levantado, o caída puntual), el sitio sigue funcionando con título/descripción nomás.
  let logoUrl: string | null = null;
  try {
    const empresa = await getCasaMatrizLogo();
    logoUrl = empresa.logoUrl;
  } catch {
    logoUrl = null;
  }

  const absoluteLogoUrl = logoUrl ? `${API_ORIGIN}${logoUrl}` : null;

  return {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    icons: absoluteLogoUrl ? { icon: absoluteLogoUrl } : undefined,
    openGraph: {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      siteName: SITE_TITLE,
      locale: "es",
      type: "website",
      images: absoluteLogoUrl ? [{ url: absoluteLogoUrl }] : undefined,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <CartRoot>{children}</CartRoot>
      </body>
    </html>
  );
}
