import { Inter, Manrope } from "next/font/google";
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

export const metadata = {
  title: "Nuevo Proyecto",
  description: "Esqueleto técnico: monorepo pnpm + Turborepo, NestJS, Next.js, Prisma.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <CartRoot>{children}</CartRoot>
      </body>
    </html>
  );
}
