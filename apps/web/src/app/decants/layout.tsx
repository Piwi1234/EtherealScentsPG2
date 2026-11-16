import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Decants de perfumes | Ethereal Scents",
  description: "Prueba perfumes originales en decants de 2, 3, 5, 10, 15, 30 y 50 ml. Ethereal Scents, Bolivia.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
