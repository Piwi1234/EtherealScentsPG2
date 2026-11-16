import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marcas de perfumes | Ethereal Scents",
  description: "Todas las marcas de perfumes originales que encuentras en Ethereal Scents, Bolivia: casas árabes, de nicho y de diseñador.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
