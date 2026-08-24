import { DM_Sans, Inter, Libre_Baskerville } from "next/font/google";
import "./globals.css";

// Inter: tipografía del Dashboard interno (.nocturne-theme) — declarada por nombre en globals.css
// pero nunca cargada de verdad hasta ahora (sin esto, el navegador caía al fallback system-ui).
//
// DM Sans (texto) + Libre Baskerville (títulos, h1/h2/h3): tipografía del sitio público
// (.landing-page) — mismo par que usa mooala.com/collections/almondmilk (Shopify, cargadas ahí vía
// fonts.shopifycdn.com), acá auto-hospedadas con next/font/google en vez de depender de Shopify.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-inter" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-dm-sans" });
const libreBaskerville = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-libre-baskerville" });

export const metadata = {
  title: "Nuevo Proyecto",
  description: "Esqueleto técnico: monorepo pnpm + Turborepo, NestJS, Next.js, Prisma.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${dmSans.variable} ${libreBaskerville.variable}`}>
      <body>{children}</body>
    </html>
  );
}
