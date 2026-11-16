import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Combos de perfumes | Ethereal Scents",
  description: "Combos de perfumes originales con descuento en Ethereal Scents, Bolivia.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
