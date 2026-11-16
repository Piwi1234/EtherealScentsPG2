import type { Metadata } from "next";

// Los resultados de la búsqueda interna no se indexan (cada búsqueda es una página distinta sin contenido propio).
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
